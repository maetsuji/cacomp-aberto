import { ImageResponse } from "next/og";
import { getCaState } from "@/lib/status";

// Open Graph image dinâmica: o preview do link (WhatsApp/Telegram/etc.)
// mostra ABERTO/FECHADO ao vivo — quem compartilha cacomp.xyz num grupo
// já responde a pergunta sem ninguém clicar. Mesmo espírito do favicon
// dinâmico (/api/icon): force-dynamic + cache curto; os crawlers
// fotografam o preview na hora do share, que é o comportamento desejado.
//
// Fonte: a default embutida do next/og (satori não lê o woff2 variável
// de src/fonts) — a identidade visual fica por conta do glow/cores.

export const dynamic = "force-dynamic";

const THEME = {
  OPEN: { label: "ABERTO", color: "#4ade80", glow: "#22c55e" },
  CLOSED: { label: "FECHADO", color: "#f87171", glow: "#dc2626" },
} as const;

export async function GET() {
  const { current_status } = await getCaState();
  const theme = THEME[current_status];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
          backgroundImage: `radial-gradient(circle at 50% 45%, ${theme.glow}26 0%, #09090b 65%)`,
        }}
      >
        <div style={{ color: "#a1a1aa", fontSize: 44 }}>O CACOMP está</div>
        <div
          style={{
            color: theme.color,
            fontSize: 190,
            fontWeight: 700,
            letterSpacing: "0.02em",
            textShadow: `0 0 24px ${theme.glow}, 0 0 90px ${theme.glow}`,
          }}
        >
          {theme.label}
        </div>
        <div style={{ color: "#52525b", fontSize: 32, marginTop: 24 }}>
          cacomp.xyz — status em tempo real
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
