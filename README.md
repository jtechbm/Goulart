# GoulartERP

ERP de gestão multi-marketplace: **Mercado Livre**, **Shopee** e **TikTok Shop** em um
sistema só, com **duas áreas separadas** —

- **Agência (Kadu)** — carteira de clientes, equipe, lojas conectadas, estoque
  consolidado, financeiro, mensalidades, suporte e as análises de IA.
- **Portal do cliente** — o lojista entra e vê só o que é dele: faturamento, lojas,
  estoque (que ele mesmo movimenta), integrações self-service e as próprias faturas.

As **análises de IA são exclusivas da agência** — não aparecem no portal.

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Prisma.

---

## Rodando em 4 comandos

```bash
npm install
cp .env.example .env      # e preencha (veja abaixo)
npm run db:push           # cria o schema
npm run db:seed           # carteira de demonstração (opcional)
npm run dev               # http://localhost:3000
```

O seed cria 7 clientes, 11 contas, 44 produtos, 6 meses de mensalidades e 60 dias de
métricas, com as contas em `PENDING` só para a interface ter o que mostrar. Quando você
conectar uma loja de verdade, o registro é assumido pelo OAuth e o sync sobrescreve os
números.

**Logins de demonstração** (o seed imprime no fim):

| Perfil | E-mail | Senha |
|---|---|---|
| Diretor (acesso total) | `kadu@jtech.com.br` | `kadu@2026` |
| Analista | `mariana@jtech.com.br` | `equipe@2026` |
| Financeiro | `pedro@jtech.com.br` | `equipe@2026` |
| Suporte | `camila@jtech.com.br` | `equipe@2026` |
| Cliente | `contato@casabella.com.br` | `cliente@2026` |

Entre com o Pedro e com a Camila para ver as permissões por função na prática.

⚠️ São credenciais de demonstração. Antes de qualquer uso real, troque a senha do gestor
e remova os usuários de teste.

---

## Como funciona o acesso

Autenticação própria: senha com **scrypt** e sessão opaca em cookie `httpOnly`. O token
no cookie não carrega dado nenhum — é só a chave de uma linha em `Session`, então revogar
acesso é apagar a linha.

O papel decide a área:

| | Rotas | Guard |
|---|---|---|
| `ADMIN` | `/`, `/clientes`, `/mensalidades`, `/estoque`, … | `src/app/(admin)/layout.tsx` |
| `CLIENT` | `/portal/*` | `src/app/(portal)/layout.tsx` |

O guard fica no **layout do grupo de rotas**, então toda página dentro dele está protegida
por construção — não dá para esquecer de proteger uma tela nova. Quem erra de área é
redirecionado para a própria: cliente que abre `/mensalidades` cai em `/portal`, e
vice-versa.

Toda consulta do portal filtra por `clientId` vindo da **sessão, nunca da URL** — inclusive
o início do OAuth: se um lojista chamar `/api/oauth/shopee/start?client=<id de outro>`, o
parâmetro é ignorado e a loja é conectada na conta dele. Só um `ADMIN` pode escolher o
cliente.

### Dando acesso a um cliente novo

Pelo cadastro (caminho normal): **Clientes → Novo cliente**. O mesmo formulário cria o
cliente, o contrato de mensalidade (opcional) e o login do portal.

Para um cliente que já existe: **Clientes → abrir o cliente → Criar novo acesso**.

Nos dois casos o sistema gera uma senha provisória e a mostra **uma única vez** — copie e
envie. No primeiro login o cliente é obrigado a definir a própria senha. Na tela do cliente
dá para **gerar nova senha** (derruba as sessões abertas) ou **bloquear** o acesso sem
apagar o histórico.

### Equipe e permissões por função

**Equipe → Adicionar pessoa** cria o cadastro e, se marcado, o login com senha provisória.
A **função** escolhida define o que a pessoa enxerga — quem é do financeiro não vê suporte,
e vice-versa:

| Função | Alcança |
|---|---|
| **Diretor** | tudo, incluindo equipe e integrações |
| **Analista de marketplace** | painel, clientes, contas, estoque, análises, relatórios |
| **Financeiro** | clientes, financeiro, mensalidades |
| **Suporte / Atendimento** | clientes, suporte |

O mapa fica em [`src/lib/permissions.ts`](src/lib/permissions.ts) — é a **fonte única**:
mudar um conjunto ali muda o menu, os guards das páginas e as server actions de uma vez.

Como funciona na prática:

- O **menu esconde** o que a função não alcança.
- Cada página chama `requirePermission(...)` **no servidor** — esconder o link não é
  proteção; quem digitar `/financeiro` na URL é devolvido para a própria área.
- As **server actions e as rotas de API** checam a mesma permissão, senão daria para
  disparar a ação sem passar pela tela.
- Cada função tem sua **porta de entrada**: o financeiro cai em `/financeiro` ao logar,
  o suporte em `/suporte` — ninguém aterrissa numa tela que não pode ver.

A função pode ser alterada depois no card da pessoa. O sistema não deixa você rebaixar a
própria função nem remover o próprio acesso — evita se trancar para fora.

---

## Mensalidades

O contrato (`Subscription`) guarda valor, dia de vencimento e forma de pagamento. O botão
**Gerar faturas do mês** materializa uma fatura por competência (`AAAA-MM`) para cada
contrato ativo e marca como `ATRASADO` o que passou do vencimento.

A geração é **idempotente** — a unique `(clientId, reference)` garante uma fatura por mês
por cliente, então clicar duas vezes não duplica.

O fluxo de pagamento é manual: o cliente vê a fatura e o meio de pagamento no portal, paga,
e o Kadu dá a baixa (`Dar baixa` / `Estornar`) em **Mensalidades → cliente**.

---

## Variáveis obrigatórias

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | SQLite em dev. Em produção, troque o `provider` em `prisma/schema.prisma` para `postgresql`. |
| `APP_URL` | URL pública. Monta os `redirect_uri`; precisa bater **exatamente** com o cadastrado em cada plataforma. |
| `ENCRYPTION_KEY` | AES-256-GCM que cifra os tokens no banco. Gere com o comando abaixo. |
| `CRON_SECRET` | Autentica o `POST /api/sync` vindo de fora do navegador. |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> **Trocar a `ENCRYPTION_KEY` invalida todos os tokens já gravados** — as lojas precisarão
> ser reconectadas. Guarde-a junto com o backup do banco.

---

## Conectando cada marketplace

A tela **Configurações → Integrações** mostra quais plataformas ainda estão sem credencial
e desabilita o botão até o `.env` estar preenchido.

### Mercado Livre
1. Crie a aplicação no [DevCenter](https://developers.mercadolivre.com.br/devcenter).
2. Cadastre o Redirect URI: `{APP_URL}/api/oauth/mercadolivre/callback`
3. Preencha `ML_CLIENT_ID` e `ML_CLIENT_SECRET`.

⚠️ O ML **exige HTTPS** no redirect URI — `http://localhost` não é aceito. Em dev, suba um
túnel (`cloudflared tunnel --url http://localhost:3000`) e aponte `APP_URL` para ele.
O fluxo usa PKCE (S256), obrigatório desde 2024.

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

---

## Sincronização

```bash
# todas as contas conectadas, últimos 30 dias
curl -X POST -H "authorization: Bearer $CRON_SECRET" https://seu-dominio/api/sync

# uma conta, janela maior
curl -X POST -H "authorization: Bearer $CRON_SECRET" "https://seu-dominio/api/sync?account=<id>&days=90"
```

O sync é **idempotente** — os pedidos usam upsert por `(accountId, externalId)` e o agregado
diário é reconstruído a partir deles. Rodar duas vezes não duplica nada.

Os tokens são renovados sozinhos quando faltam menos de 10 minutos para expirar. Se o refresh
falhar, a conta vira `EXPIRED`/`ERROR`, aparece nos alertas do Painel e ganha um botão de
reconexão em Integrações.

Na Vercel, agende com `vercel.json`:

```json
{ "crons": [{ "path": "/api/sync", "schedule": "0 */6 * * *" }] }
```

---

## Estrutura

```
src/
├── app/
│   ├── login/                tela de entrada (pública)
│   ├── trocar-senha/         primeiro acesso e troca de senha
│   ├── (admin)/              ÁREA DA AGÊNCIA — guard no layout do grupo
│   │   ├── clientes/[clientId]/   dados, acessos ao portal e lojas
│   │   ├── mensalidades/[clientId]/  contrato, histórico e próximas faturas
│   │   ├── estoque/  contas/  financeiro/  analise/  relatorios/  …
│   ├── (portal)/portal/      ÁREA DO CLIENTE — guard no layout do grupo
│   │   ├── financeiro/  lojas/  estoque/  integracoes/  faturas/  suporte/
│   └── api/
│       ├── oauth/[platform]/start     inicia o OAuth (state + PKCE)
│       ├── oauth/[platform]/callback  troca o code por tokens
│       └── sync                       dispara a sincronização
├── components/               shell, gráficos e primitivos de UI
└── lib/
    ├── integrations/         um adapter por marketplace, atrás de uma interface só
    ├── auth.ts / password.ts sessão, guards e hashing (separados de propósito:
    │                         o seed importa o hashing sem arrastar `next/headers`)
    ├── permissions.ts        funções da agência e o que cada uma alcança
    ├── crypto.ts             AES-256-GCM, HMAC, PKCE
    ├── tokens.ts             refresh transparente
    ├── sync.ts               pedidos + agregado diário + catálogo/estoque
    ├── inventory.ts          entrada/saída de estoque com write-back e ledger
    ├── billing.ts            contratos, geração de faturas, projeção
    ├── analysis.ts           motor "5 focos"
    └── queries.ts            agregações das telas (aceitam clientId p/ escopo)
```

Scripts de desenvolvimento (nunca em produção):

- `scripts/dev-session.ts` — emite tokens de sessão para testar rotas com `curl`.
- `scripts/dev-check-inventory.ts` — exercita entrada, saída, saldo negativo e o escopo
  por cliente do módulo de estoque.
- `scripts/dev-check-permissions.ts` — abre todas as rotas da agência com cada função e
  aponta divergências (servidor precisa estar no ar).

Adicionar um quarto marketplace = implementar `MarketplaceAdapter` em
`src/lib/integrations/` e registrá-lo no `index.ts`. Nenhuma tela muda.

---

## Notas

**Comissões.** Mercado Livre entrega `sale_fee` junto do pedido, mas Shopee e TikTok expõem
o repasse em endpoints separados (`/payment/get_escrow_detail` e `/finance/202309/statements`).
Nessas duas, `fees` fica em zero até você plugar esses endpoints — o rodapé da Composição de
custo deixa isso explícito na tela.

**ADS.** `adsSpend` existe no schema e aparece no Painel/Financeiro, mas nenhuma das três APIs
de Ads está conectada ainda; hoje o campo só é preenchido pelo seed.

**Análise de IA.** O motor de 5 focos é determinístico — regras sobre as métricas
sincronizadas, sem chamada a LLM, então roda sem credencial extra. Para trocar por um modelo,
o ponto de extensão é `runAnalysis()` em `src/lib/analysis.ts`: basta devolver o mesmo
`Focus[]` e nenhuma tela muda.

**Estoque.** O catálogo vem junto no sync (`fetchProducts`). O TikTok Shop não devolve
quantidade vendida no endpoint de produtos, então `soldCount` fica zerado lá.

O cliente movimenta o próprio estoque em **Portal → Estoque**, e cada entrada/saída vira
uma linha em `StockMovement` com autor, motivo e saldo antes/depois.

O detalhe que importa: para produto vindo do marketplace (`origin: SYNCED`) o novo saldo é
**escrito de volta na API** antes de mexer no banco. Se a escrita falhar, o saldo local
**não muda** e o erro aparece na tela — senão o próximo sync desfaria o ajuste e o lojista
veria o número "voltar sozinho". Produtos criados à mão (`origin: MANUAL`) são só locais, e
o sync não os apaga.

Limitação conhecida: anúncios com variação (mais de um SKU/model) não são ajustáveis por
aqui — a API exige o saldo por variação. Nesse caso o sistema recusa com uma mensagem
explicando, em vez de gravar um número errado.

**O que falta antes de expor na internet.** O login funciona, mas ainda não há: recuperação
de senha por e-mail (hoje o Kadu gera senha provisória na mão), 2FA, rate limit nas
tentativas de login, e log de auditoria. Nada disso é bloqueante para uso interno, mas
coloque ao menos rate limit antes de abrir para a internet.

**Cores dos gráficos.** A paleta categórica (violeta/laranja/aqua) foi validada para
daltonismo e contraste nos temas claro e escuro. Trocar as cores sem revalidar quebra a
acessibilidade — a ordem dos slots é o mecanismo de segurança, não decoração.
