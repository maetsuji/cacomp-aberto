import type { Metadata, Viewport } from "next";
import { Inter, Tilt_Neon } from "next/font/google";
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

// Monaspace Neon (variável) — usada nos textos mono (ex.: /admin).
const monaspaceNeon = localFont({
  src: "../fonts/MonaspaceNeonVF.woff2",
  variable: "--font-monaspace",
  display: "swap",
  weight: "200 800", // faixa do eixo wght da variável
});

// Tilt Neon: a fonte da placa ABERTO/FECHADO — glifos construídos como
// tubos de neon de vitrine. Os eixos variáveis XROT/YROT inclinam os
// glifos como uma placa vista em perspectiva; os valores (10/-10) são
// aplicados via font-variation-settings no globals.css (.status-font).
const tiltNeon = Tilt_Neon({
  subsets: ["latin"],
  variable: "--font-tilt",
  display: "swap",
  // Sem `weight`: next/font exige weight ausente/"variable" quando se
  // carregam eixos extras (a Tilt Neon só tem o peso 400 mesmo).
  axes: ["XROT", "YROT"],
});

export const metadata: Metadata = {
  title: "CA Aberto? — CACOMP UnB",
  description:
    "O Centro Acadêmico de Computação da UnB está aberto agora? Status em tempo real, reportado pela comunidade.",
  icons: {
    icon: "/api/icon", // aponta para src/app/api/icon/route.ts (route handler dinâmico)
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${monaspaceNeon.variable} ${tiltNeon.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
