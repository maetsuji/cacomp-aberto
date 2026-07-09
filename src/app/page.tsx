import { TimeAgo } from "@/components/TimeAgo";
import { getCaState, getRecentReports } from "@/lib/status";
import type { CaStatus } from "@/lib/types";

/* ─────────────────────────── ESTRATÉGIA DE CACHE ───────────────────────────
 *
 * Esta página usa ISR com On-demand Revalidation (Seção 6 do SDD):
 *
 * 1. No build (e a cada revalidação), o Next.js executa este Server
 *    Component, lê o estado no Vercel KV e gera HTML ESTÁTICO.
 * 2. Esse HTML fica na CDN da Vercel — todo acesso da comunidade é
 *    servido da borda, sem tocar em função serverless nem no Redis.
 *    Custo por visita: zero. Latência: a de um arquivo estático.
 * 3. Quando alguém escaneia um QR Code e o reporte é validado,
 *    `processReport()` (src/lib/report.ts) chama `revalidatePath("/")`.
 *    Isso invalida o cache NA HORA: o próximo visitante dispara uma
 *    regeneração e todos passam a ver o novo status imediatamente.
 * 4. O `revalidate` abaixo é apenas uma REDE DE SEGURANÇA: se nenhum
 *    reporte acontecer, a página se regenera sozinha a cada 5 minutos.
 *    Isso não é o mecanismo principal de atualização (o on-demand é) —
 *    serve só para o feed nunca ficar servindo dados órfãos caso algo
 *    escreva no KV por fora do fluxo de reporte.
 *
 * Resultado: comportamento de "tempo real" percebido pelo usuário, com
 * custo de página estática — ideal para o plano Hobby da Vercel.
 * ──────────────────────────────────────────────────────────────────────── */
export const revalidate = 300;

const THEME: Record<
  CaStatus,
  {
    bg: string;
    glow: string; // cor saturada do brilho externo da placa de neon
    glowDim: string; // camada mais externa/suave do brilho
    label: string;
    emoji: string;
    hint: string;
  }
> = {
  OPEN: {
    bg: "bg-green-500",
    glow: "#4ade80",
    glowDim: "#15803d",
    label: "ABERTO",
    emoji: "🟢",
    hint: "Alguém confirmou presença no CA.",
  },
  CLOSED: {
    bg: "bg-red-950",
    glow: "#ff7070",
    glowDim: "#ff2222",
    label: "FECHADO",
    emoji: "🔴",
    hint: "Encontrou o CA aberto? Escaneie o QR Code lá dentro.",
  },
};

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export default async function HomePage() {
  // Leituras feitas UMA vez por regeneração, nunca por visita (ver acima).
  const [state, reports] = await Promise.all([
    getCaState(),
    getRecentReports(5),
  ]);

  const theme = THEME[state.current_status];
  const isOpen = state.current_status === "OPEN";

  return (
    <main
      className={`flex min-h-dvh flex-col ${theme.bg} ${
        isOpen ? "text-green-950" : "text-zinc-50"
      }`}
    >
      {/* ── Bloco principal: o status domina a tela (mobile-first) ── */}
      <section className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium uppercase tracking-widest opacity-70">
          CA de Computação · UnB
        </p>

        {/* Monaspace Neon com texture healing (calt) + efeito de placa de
            neon (núcleo claro + brilho externo em camadas, ver .neon-text
            em globals.css). font-extrabold porque o eixo wght da variável
            vai até 800, não 900. */}
        <h1
          className="texture-healing neon-text font-mono text-6xl font-extrabold tracking-tight sm:text-7xl"
          style={
            {
              "--neon-color": theme.glow,
              "--neon-color-dim": theme.glowDim,
            } as React.CSSProperties
          }
        >
          {theme.label}
        </h1>

        <p className="text-base opacity-80">
          Atualizado <TimeAgo iso={state.updated_at} />
        </p>

        <p className="mt-6 max-w-xs text-sm opacity-60">{theme.hint}</p>
      </section>

      {/* ── Feed de transparência: últimos 5 reportes anônimos ── */}
      <footer
        className={`px-6 pb-8 pt-4 ${
          isOpen ? "border-t border-green-600/40" : "border-t border-zinc-800"
        }`}
      >
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest opacity-60">
          Últimos reportes
        </h2>

        {reports.length === 0 ? (
          <p className="text-sm opacity-50">Nenhum reporte ainda hoje.</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((report) => (
              <li
                key={report.id}
                className="flex items-baseline justify-between gap-4 text-sm"
              >
                <span className="opacity-80">
                  Alguém reportou{" "}
                  <strong>
                    {report.action === "OPEN" ? "“Aberto”" : "“Fechado”"}
                  </strong>
                </span>
                <span className="shrink-0 tabular-nums opacity-50">
                  às {formatClock(report.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-center text-xs opacity-40">
          Reportes anônimos via QR Code no local ·{" "}
          <a
            href="https://github.com/maetsuji/cacomp-aberto"
            className="underline underline-offset-2"
          >
            código aberto
          </a>
        </p>
      </footer>
    </main>
  );
}
