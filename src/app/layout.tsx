import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Fonte padrão do sistema: Inter (variável), peso base semibold
// definido no globals.css. Self-hosted pelo next/font (zero request
// externo, sem FOUT).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Monaspace Neon (variável) — usada no status ABERTO/FECHADO.
// O texture healing da Monaspace é implementado via feature OpenType
// "calt", ativada no globals.css (.texture-healing).
const monaspaceNeon = localFont({
  src: "../fonts/MonaspaceNeonVF.woff2",
  variable: "--font-monaspace",
  display: "swap",
  weight: "200 800", // faixa do eixo wght da variável
});

export const metadata: Metadata = {
  title: "CA Aberto? — CACOMP UnB",
  description:
    "O Centro Acadêmico de Computação da UnB está aberto agora? Status em tempo real, reportado pela comunidade.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${monaspaceNeon.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
