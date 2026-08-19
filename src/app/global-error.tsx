"use client";

import { useEffect } from "react";

/**
 * Último anteparo: pega erro que estourou no próprio layout raiz, quando o
 * `error.tsx` normal nem chega a montar. Precisa trazer <html> e <body>
 * próprios, porque neste ponto o layout da aplicação não existe — e por isso
 * também não pode depender de nenhum token de tema ou componente nosso.
 */
export default function ErroGlobal({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(JSON.stringify({ nivel: "erro", evento: "ui.erro_global", digest: error.digest }));
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#0b0810",
          color: "#f5f3fa",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>O sistema não conseguiu carregar</h1>
          <p style={{ color: "#b7afc9", fontSize: 14, marginTop: 8 }}>
            Recarregue a página. Se continuar, tente novamente em alguns minutos.
          </p>
          {error.digest && (
            <p style={{ color: "#8b8299", fontSize: 12, marginTop: 16 }}>Código: {error.digest}</p>
          )}
          {/* <a> puro, e não <Link>: aqui o layout raiz falhou, então o roteador
              do Next pode estar inutilizável. Uma navegação client-side tentaria
              remontar o mesmo app quebrado; o que resolve é recarregar do zero. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: "inline-block", marginTop: 24, padding: "10px 16px",
              borderRadius: 12, background: "#8b5cf6", color: "#fff",
              textDecoration: "none", fontSize: 14, fontWeight: 600,
            }}
          >
            Recarregar
          </a>
        </div>
      </body>
    </html>
  );
}
