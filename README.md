# ArtSul Decorações

SaaS completo do lojista que vende em marketplace **e** no atacado: **Mercado Livre**,
**Shopee**, **TikTok Shop** e **SHEIN** de um lado, vendas por fora do outro — faturamento,
estoque compartilhado entre os dois, financeiro, chat unificado, gerenciamento de
clientes/fornecedores e relatórios, tudo num lugar só.

Há **um único tipo de usuário**: a pessoa da loja. Tudo que ela vê é escopado pelo
`clientId` da sessão.

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Prisma · Postgres.

> **MVP de demonstração.** Mercado Livre, Shopee e TikTok Shop têm integração OAuth real
> (ver [Conectando cada marketplace](#conectando-cada-marketplace)); SHEIN e o financeiro
> "repasse de marketplace" são fictícios — não existe adapter de SHEIN nem API de repasse
> conectada. O que dá pra testar de ponta a ponta, com dado de verdade no banco, é semeado
> pelo `npm run dados-demo` (ver [Dados de demonstração](#dados-de-demonstração)).

---

## Rodando

```bash
npm install
cp .env.example .env      # e preencha (veja abaixo)
npm run db:push           # aplica o schema
npm run dev               # http://localhost:3000
```

O banco nasce vazio. Há duas formas de criar acesso.

### Cadastro aberto

`/cadastro` cria a empresa e o login juntos, numa transação. **Não há confirmação por
e-mail** — nada de serviço de e-mail está configurado, então dá para se cadastrar com
endereço falso. O que existe é limite de **5 cadastros por IP a cada 15 minutos**, que
segura volume, não falsidade. Antes de abrir isto ao público, plugue a confirmação.

Cada cadastro cria a **própria** empresa, mesmo que já exista outra de nome igual:
`clientId` é o escopo de isolamento, e reaproveitar por nome colocaria dois desconhecidos
dentro dos mesmos dados.

### Criando o acesso pela linha de comando

```bash
npm run criar-acesso -- --loja "Nome da Empresa" --nome "Maria" --email maria@empresa.com.br
```

O script reaproveita a empresa se ela já existir (duas pessoas da mesma loja precisam
apontar para o mesmo `clientId`), sorteia a senha e a imprime **uma única vez** — copie e
envie. Com `--senha` você define uma. Não há tela obrigatória de troca no primeiro acesso:
a pessoa entra direto e troca quando quiser, pelo ícone de chave no topo.

### Dados de demonstração

```bash
npm run dados-demo -- --loja "Nome da Empresa"
npm run dados-demo -- --loja "Nome da Empresa" --limpar
```

Popula a empresa (que precisa já existir — rode `criar-acesso` antes) com ~90 dias de
histórico: 4 contas de marketplace + a conta interna de Atacado, ~30 produtos (parte deles
também no catálogo de atacado), ~120 pedidos de marketplace e ~18 de atacado, clientes e
fornecedores, lançamentos financeiros (alguns pagos, alguns vencidos de propósito) e 14
conversas de chat com mensagem não lida. Idempotente — roda de novo sem duplicar — e
`--limpar` desfaz tudo daquela empresa (contas com `externalId` prefixado por `demo-`, mais
todo `Customer`/`FinanceEntry`/`Conversation`/`Settings` do cliente).

Separado do `dados-exemplo` original (que continua existindo, mais enxuto: só um Mercado
Livre com 5 produtos e 6 pedidos).

---

## Como funciona o acesso

Autenticação própria: senha com **scrypt** e sessão opaca em cookie `httpOnly`. O token
no cookie não carrega dado nenhum — é só a chave de uma linha em `Session`, então revogar
acesso é apagar a linha.

O guard fica no **layout do grupo de rotas** (`src/app/(app)/layout.tsx`), então toda
página dentro dele está protegida por construção — não dá para esquecer de proteger uma
tela nova. `requireClient()` exige sessão **e** `clientId`; um usuário sem loja vinculada
tem a sessão encerrada e volta ao login com a explicação, em vez de entrar em laço de
redirect.

Toda consulta filtra por `clientId` vindo da **sessão, nunca da URL** — inclusive o início
do OAuth. Em `accountRollups()` o `clientId` é o primeiro parâmetro e obrigatório de
propósito: quando era opcional, esquecê-lo devolvia silenciosamente a base inteira.

### Fechando o banco (RLS)

O Supabase publica um PostgREST em `https://<ref>.supabase.co/rest/v1/` e, por padrão, dá
a `anon` **todos os privilégios** em tudo que está no schema `public`. A chave `anon` é
pública por projeto. Sem RLS isso significa: qualquer um com essa chave lê `Session` e
vira qualquer usuário, lê os hashes em `User`, lê os tokens dos marketplaces em `Account`
e pode dar `TRUNCATE`.

Esta aplicação não usa a API do Supabase — fala Postgres direto, com o papel `postgres`,
que tem `rolbypassrls`. Então a proteção mais forte também é a mais simples: **RLS ligado
e nenhuma policy**. PostgREST nega tudo, a aplicação não sente nada.

```bash
npm run db:secure     # idempotente
```

⚠️ `prisma db push` cria tabela nova **sem** RLS, e os privilégios padrão do Supabase a
entregam a `anon` de novo. Por isso o `db:push` deste projeto já encadeia o `db:secure`, e
o script também mexe em `ALTER DEFAULT PRIVILEGES` para a próxima tabela nascer fechada.
Se você aplicar schema por fora (Studio, SQL Editor), rode o `db:secure` depois.

---

## Variáveis obrigatórias

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | Postgres (pooler, porta 6543 no Supabase) — usado em runtime. |
| `DIRECT_URL` | Conexão direta (porta 5432) — usada só por `prisma db push`/`migrate`. |
| `APP_URL` | URL pública. Monta os `redirect_uri`; precisa bater **exatamente** com o cadastrado em cada plataforma. Sem ela, cai no domínio de produção que a Vercel injeta. |
| `ENCRYPTION_KEY` | AES-256-GCM que cifra os tokens no banco. Gere com o comando abaixo. |
| `CRON_SECRET` | Autentica o `POST /api/sync` vindo de fora do navegador. |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> **Trocar a `ENCRYPTION_KEY` invalida todos os tokens já gravados** — as lojas precisarão
> ser reconectadas. Guarde-a junto com o backup do banco, e mantenha a mesma chave em
> todos os ambientes que apontam para o mesmo banco.

---

## Conectando cada marketplace

A tela **Integrações** mostra só as plataformas cujas credenciais existem no `.env`. Um
card que só sabe dizer "indisponível" convida o lojista a tentar algo que não vai
funcionar — quando as chaves entram, o card volta sozinho.

### Mercado Livre
1. Crie a aplicação no [DevCenter](https://developers.mercadolivre.com.br/devcenter).
2. Cadastre o Redirect URI: `{APP_URL}/api/oauth/mercadolivre/callback`
3. Preencha `ML_CLIENT_ID` e `ML_CLIENT_SECRET`.

⚠️ O ML **exige HTTPS** no redirect URI — `http://localhost` não é aceito. Em dev, suba um
túnel (`cloudflared tunnel --url http://localhost:3000`) e aponte `APP_URL` para ele.
O fluxo usa PKCE (S256), obrigatório desde 2024.

Confira também as **permissões da aplicação** no DevCenter: com "Publicação e sincronização"
em *Sem acesso*, os endpoints de produtos e categorias respondem 403 mesmo com token válido.

### Shopee
1. Crie o app no [Open Platform](https://open.shopee.com).
2. Redirect URI: `{APP_URL}/api/oauth/shopee/callback`
3. Preencha `SHOPEE_PARTNER_ID` e `SHOPEE_PARTNER_KEY`.
4. `SHOPEE_HOST` começa no sandbox (`partner.test-stable.shopeemobile.com`); troque para
   `partner.shopeemobile.com` ao ir para produção.

Toda chamada é assinada com HMAC-SHA256. O refresh token vale **30 dias** — se a loja ficar
um mês sem sync, precisa reconectar.

### TikTok Shop
1. Crie o app no [Partner Center](https://partner.tiktokshop.com).
2. Callback URL do app: `{APP_URL}/api/oauth/tiktok/callback`
3. Preencha `TIKTOK_APP_KEY`, `TIKTOK_APP_SECRET` e `TIKTOK_SERVICE_ID`.

O TikTok não aceita `redirect_uri` na query — ele usa o Callback URL cadastrado no app.
Após autorizar, o sistema busca o `shop_cipher` da loja (obrigatório em todas as chamadas
seguintes) e o revalida a cada refresh.

### SHEIN e Atacado — não são OAuth

Nem todo canal em `src/lib/canais.ts` tem adapter. **SHEIN** aparece em filtros, gráficos,
relatórios e chat com dado fictício, mas não tem integração automática — o card em
Integrações mostra "em breve", sem botão de conectar. **Atacado** nunca vai ter OAuth: é
canal interno, uma `Account` sintética (`platform: "ATACADO"`) criada sob demanda por
`contaAtacado()` em `src/lib/wholesale.ts`. Adicionar um adapter de verdade para a SHEIN é
o mesmo caminho de Shopee/TikTok: implementar `MarketplaceAdapter`, registrar em
`integrations/index.ts` e trocar `PLATFORMS`/`adapters` — os cards e o card "em breve"
saem sozinhos.

---

## Comparador de preços

Você escolhe um produto seu e o sistema busca os concorrentes **do mesmo produto, na mesma
plataforma**. Nada é digitado à mão.

**Mercado Livre** usa a API oficial: `/products/search` acha os produtos de catálogo pelo
título e `/products/{id}/items` devolve todos os vendedores daquele produto com preço
exato. É rápido (~5s) e roda ao abrir a tela.

⚠️ **Limitação real, medida:** `/products/{id}/items` lista só quem disputa a Buy Box de um
produto de catálogo. Em categorias onde os vendedores não publicam no catálogo — decoração,
cama/mesa/banho, artesanato — ele devolve `404 No winners found` e não há o que comparar:

| Busca | Catálogos | Com concorrentes | Ofertas |
|---|---|---|---|
| `iphone 15 128gb` | 10 | 6 | 190 |
| `echo dot 5` | 10 | 3 | 16 |
| `almofada decorativa veludo` | 10 | **0** | 0 |

A alternativa seria `/sites/MLB/search`, a busca por palavra-chave que o comprador vê, mas
o Mercado Livre a restringiu — responde **403** mesmo com token de aplicação válido. Quando
não há concorrentes, a tela explica o porquê em vez de dizer só "não encontrado".

**Shopee e TikTok Shop** não têm API pública de busca. Para elas existe um caminho por IA
(`OPENAI_API_KEY`, Responses API com busca na web) que roda **por ação explícita**, nunca ao
abrir a tela: leva ~26s e cada busca custa dinheiro. O resultado fica gravado em
`MarketComparison` e é sempre rotulado como **estimativa** — cada preço é conferido contra o
trecho da página de onde foi lido, e o que não bate é descartado.

---

## Sincronização

O botão **Atualizar agora** em *Minhas lojas* dispara o sync das lojas de quem está logado.
Fora do navegador, com o `CRON_SECRET`, o sync roda sobre todas as lojas:

```bash
# todas as lojas, últimos 30 dias
curl -X POST -H "authorization: Bearer $CRON_SECRET" https://seu-dominio/api/sync

# uma loja, janela maior
curl -X POST -H "authorization: Bearer $CRON_SECRET" "https://seu-dominio/api/sync?account=<id>&days=90"
```

O sync é **idempotente** — os pedidos usam upsert por `(accountId, externalId)` e o agregado
diário é reconstruído a partir deles. Rodar duas vezes não duplica nada.

Os tokens são renovados sozinhos quando faltam menos de 10 minutos para expirar. Se o refresh
falhar, a conta vira `EXPIRED`/`ERROR`, aparece no sino e ganha um botão de reconexão em
Integrações.

Na Vercel, agende com `vercel.json`:

```json
{ "crons": [{ "path": "/api/sync", "schedule": "0 */6 * * *" }] }
```

---

## Atacado, Financeiro, Chat e Gerenciamento

### Atacado — o quinto canal

O atacado **não é um módulo isolado**: é mais um canal, uma `Account` sintética com
`platform: "ATACADO"` (uma por cliente, `contaAtacado()` cria sob demanda). Isso é
deliberado — `accountRollups`, `revenueSeries`, o relatório por plataforma e os gráficos já
sabem lidar com contas, então o atacado aparece em Faturamento/Relatórios sem nenhum código
especial para ele.

Também não duplica produto: `Product.wholesalePrice` marca um produto **já existente** (de
qualquer marketplace) como vendável no atacado — "importar" é só preencher esse preço.
Produtos exclusivos do atacado nascem `origin: MANUAL` na conta ATACADO. Um pedido de
atacado baixa estoque pelo mesmo `moveStock()` de `/estoque` (ledger incluso) e recompõe o
`DailyMetric` do dia a partir do próprio pedido — nunca inventa número solto, senão
Faturamento discordaria de Vendas. Tudo isso em `src/lib/wholesale.ts`.

### Financeiro

`FinanceEntry` cobre a receber, a pagar, despesas e repasses de marketplace. O status
(pago/pendente/atrasado) **nunca é gravado** — `statusDe()` em `src/lib/finance.ts` deriva
de `paidAt`/`dueDate` na leitura, porque um status salvo no banco envelhece sozinho e passa
a mentir assim que a data vence.

### Chat

Conversas fictícias por enquanto (`Conversation`/`Message`), uma por plataforma, com
resposta automática ~1,8s depois do envio (`src/lib/chat.ts` + `chatActions.ts`) — dá pra
demonstrar ao vivo sem depender de API de mensageria nenhuma.

### Gerenciamento

`Customer` serve clientes **e** fornecedores (`kind`) — mesma tabela, mesmos campos,
telas separadas por aba. `Order.customerId` liga o pedido de atacado a quem comprou.

### Alíquota e limite de estoque vêm de Configurações

`Settings` guarda alíquota, custo extra padrão e limite de estoque baixo por cliente.
`TAX_RATE`/`LOW_STOCK` continuam existindo como **fallback** em `queries.ts`/`inventory.ts`
— a linha de `Settings` só nasce quando alguém salva algo em `/configuracoes`
(`configuracoes()` nunca cria implicitamente). `gerarRelatorio`, `gerarAnalitico`, Vendas e
o pedido de atacado já leem daqui.

---

## Estrutura

```
src/
├── app/
│   ├── login/                tela de entrada (pública)
│   ├── cadastro/             criação de conta (pública, com limite por IP)
│   ├── trocar-senha/         troca voluntária de senha
│   ├── (app)/                O SISTEMA — guard no layout do grupo
│   │   ├── page.tsx          Início
│   │   ├── vendas/           lucro e margem item a item (marketplace)
│   │   ├── atacado/          pedidos, catálogo e novo pedido de atacado
│   │   ├── chat/             conversas de todas as plataformas
│   │   ├── comparador/       comparador de preços
│   │   ├── faturamento/      receita, custos e margem
│   │   ├── financeiro/       caixa, a receber/pagar e repasses
│   │   ├── relatorios/       analítico, faturamento, produtos, estoque, financeiro
│   │   ├── estoque/          movimentação, custos e ledger
│   │   ├── lojas/            desempenho por loja + sync manual
│   │   ├── gerenciamento/    clientes e fornecedores
│   │   ├── integracoes/      conectar/reconectar marketplaces
│   │   └── configuracoes/    empresa, fiscal, aparência, notificações
│   └── api/
│       ├── oauth/[platform]/start     inicia o OAuth (state + PKCE)
│       ├── oauth/[platform]/callback  troca o code por tokens
│       └── sync                       dispara a sincronização
├── components/               shell, gráficos, ChatThread e primitivos de UI
└── lib/
    ├── integrations/         um adapter por marketplace, atrás de uma interface só
    ├── canais.ts             fonte única dos 5 canais (label, cor, slot de série)
    ├── brand.ts              nome e logo do produto (ponto único)
    ├── auth.ts / password.ts sessão, guards e hashing (separados de propósito:
    │                         os scripts importam o hashing sem arrastar `next/headers`)
    ├── crypto.ts             AES-256-GCM, HMAC, PKCE
    ├── rateLimit.ts          limite de tentativas de login e de cadastro
    ├── sales.ts              a conta de lucro e margem por item (fonte única)
    ├── wholesale.ts          conta ATACADO, catálogo de atacado, pedido de atacado
    ├── finance.ts            lançamentos, status derivado, fluxo de caixa
    ├── chat.ts / chatActions.ts  conversas e mensagens (+ resposta automática)
    ├── customers.ts          clientes e fornecedores
    ├── settings.ts           configurações por cliente (com fallback)
    ├── tokens.ts             refresh transparente
    ├── sync.ts               pedidos + agregado diário + catálogo/estoque
    ├── inventory.ts          entrada/saída de estoque com write-back e ledger
    ├── notifications.ts      o que alimenta o sino
    ├── reports.ts            gerarRelatorio (faturamento) e gerarAnalitico
    └── queries.ts            agregações das telas (sempre escopadas por clientId)
```

Scripts:

- `scripts/criar-acesso.ts` — cria a loja e o login (é o caminho oficial de cadastro).
- `scripts/proteger-banco.ts` — liga RLS e revoga os privilégios de `anon`/`authenticated`.
  Roda sozinho no fim do `db:push`.
- `scripts/dados-exemplo.ts` — 6 pedidos e 5 produtos de Mercado Livre para dar o que ver
  nas telas. Cada caso cobre um estado: lucro, prejuízo por frete grátis, custo em branco e
  venda sem produto vinculado. `--limpar` remove.
- `scripts/dados-demo.ts` — a demonstração completa: 4 marketplaces + atacado, ~90 dias de
  histórico, financeiro e chat. Ver [Dados de demonstração](#dados-de-demonstração).
  `--limpar` remove.
- `scripts/dev-check-inventory.ts` — exercita entrada, saída, saldo negativo e o escopo
  por cliente do módulo de estoque. Só desenvolvimento.

Adicionar um quarto marketplace = implementar `MarketplaceAdapter` em
`src/lib/integrations/` e registrá-lo no `index.ts`. Nenhuma tela muda.

### Trocando a marca

Nome e logo saem de [`src/lib/brand.ts`](src/lib/brand.ts) e de `public/logo.png`.
Substituir a imagem troca a logo na sidebar e no login; `src/app/icon.png` é o favicon.

---

## Notas

**Comissões.** Mercado Livre entrega `sale_fee` junto do pedido, mas Shopee e TikTok expõem
o repasse em endpoints separados (`/payment/get_escrow_detail` e `/finance/202309/statements`).
Nessas duas, `fees` fica em zero até você plugar esses endpoints — o rodapé da Composição de
custo deixa isso explícito na tela.

**ADS.** `adsSpend` existe no schema e aparece em Faturamento, mas nenhuma das três APIs
de Ads está conectada ainda; hoje o campo fica zerado.

**Imposto.** O valor em Faturamento/Vendas/Relatórios é uma estimativa pela alíquota
configurada em `/configuracoes` (fallback `TAX_RATE` em `src/lib/queries.ts` enquanto não
há `Settings` salvo), não um cálculo fiscal.

**Estoque.** O catálogo vem junto no sync (`fetchProducts`). O TikTok Shop não devolve
quantidade vendida no endpoint de produtos, então `soldCount` fica zerado lá.

O detalhe que importa: para produto vindo do marketplace (`origin: SYNCED`) o novo saldo é
**escrito de volta na API** antes de mexer no banco. Se a escrita falhar, o saldo local
**não muda** e o erro aparece na tela — senão o próximo sync desfaria o ajuste e o lojista
veria o número "voltar sozinho". Produtos criados à mão (`origin: MANUAL`) são só locais, e
o sync não os apaga.

Limitação conhecida: anúncios com variação (mais de um SKU/model) não são ajustáveis por
aqui — a API exige o saldo por variação. Nesse caso o sistema recusa com uma mensagem
explicando, em vez de gravar um número errado.

**O que falta antes de expor na internet.** O login funciona, mas ainda não há: recuperação
de senha por e-mail (hoje a senha provisória é gerada pelo script), 2FA, rate limit nas
tentativas de login, e log de auditoria. Coloque ao menos rate limit antes de abrir para a
internet.

**Cores dos gráficos.** A paleta categórica tem 5 slots fixos — violeta (Mercado Livre),
laranja (Shopee), aqua (TikTok Shop), azul (SHEIN), vinho (Atacado) — validados para
daltonismo e contraste nos temas claro e escuro com `dataviz/scripts/validate_palette.js`.
Trocar as cores ou a ordem sem revalidar quebra a acessibilidade — a ordem dos slots é o
mecanismo de segurança, não decoração. Um 6º canal exige revalidar o par novo contra os
cinco existentes (`--pairs all`), não só escolher uma cor bonita.
