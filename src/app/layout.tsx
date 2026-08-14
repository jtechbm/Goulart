import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description: "Faturamento, estoque e integrações das lojas em Mercado Livre, Shopee e TikTok Shop.",
};

// Evita o flash de tema errado: aplica o data-theme antes da primeira pintura.
const THEME_SCRIPT = `try{document.documentElement.dataset.theme=localStorage.getItem('jtech-theme')||'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      {/* O shell (sidebar) vive no layout do grupo (app): o login e a troca de
          senha não têm menu. */}
      <body>{children}</body>
    </html>
  );
}
