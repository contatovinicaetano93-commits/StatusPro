import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StatusPro",
  description: "Cockpit de decisão para distribuição — caixa, estoque, vendas e margem.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
