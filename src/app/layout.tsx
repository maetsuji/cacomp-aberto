import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { ViewTransitions } from "next-view-transitions";
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
  metadataBase: new URL(process.env.SITE_URL ?? "https://cacomp.xyz"),
  title: "CA Aberto? — CACOMP UnB",
  description:
    "O Centro Acadêmico de Computação da UnB está aberto agora? Status em tempo real, reportado pela comunidade.",
  icons: {
    icon: "/api/icon", // aponta para src/app/api/icon/route.ts (route handler dinâmico)
  },
  // Preview de link dinâmico: /api/og desenha ABERTO/FECHADO ao vivo —
  // compartilhar cacomp.xyz num grupo já mostra o status no preview.
  openGraph: {
    images: ["/api/og"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/api/og"],
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // ViewTransitions (next-view-transitions): crossfade suave entre
    // páginas (Home ↔ /stats) via View Transitions API; browsers sem
    // suporte (Firefox) navegam instantâneo, sem quebrar.
    <ViewTransitions>
      <html
        lang="pt-BR"
        className={`${inter.variable} ${monaspaceNeon.variable} ${tiltNeon.variable}`}
      >
        <body className="antialiased">
          {/* ── Fundo persistente: tijolo + véu + blobs vivem AQUI (o
              layout não desmonta em navegação client-side), então a
              animação dos blobs continua de onde estava ao trocar de
              página. Cada página injeta as cores/opacidade via
              <BackgroundStyle> (CSS vars no :root); páginas com <main>
              opaco (/admin, /report) simplesmente cobrem o fundo. ── */}
          <div className="brick-bg" aria-hidden />
          <div className="brick-overlay" aria-hidden />
          <div className="blob-field" aria-hidden>
            <div className="blob blob-1" />
            <div className="blob blob-2" />
            <div className="blob blob-3" />
          </div>
          {children}
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ViewTransitions>
  );
}
