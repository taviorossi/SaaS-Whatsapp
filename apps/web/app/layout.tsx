import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CompraZap',
  description: 'Planejamento de compras via WhatsApp + IA',
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
