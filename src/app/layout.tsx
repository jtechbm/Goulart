import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoulartERP — Multi-marketplace",
  description: "ERP de gestão multi-marketplace: Mercado Livre, Shopee e TikTok Shop.",
};

// Evita o flash de tema errado: aplica o data-theme antes da primeira pintura.
const THEME_SCRIPT = `try{document.documentElement.dataset.theme=localStorage.getItem('jtech-theme')||'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      {/* O shell (sidebar) vive nos layouts de cada área — a agência e o
          portal do cliente têm menus diferentes, e o login não tem nenhum. */}
      <body>{children}</body>
    </html>
  );
}
