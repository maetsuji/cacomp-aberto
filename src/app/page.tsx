import { TimeAgo } from "@/components/TimeAgo";
import { maybeAutoClose } from "@/lib/auto-close";
import { getBlobTheme } from "@/lib/blob-theme";
import { getRandomGif } from "@/lib/gif";
import { AUTO_CLOSE_REPORTER_ID, getRecentReports } from "@/lib/status";
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
    glow: string; // cor saturada do brilho externo da placa de neon
    glowDim: string; // camada mais externa/suave do brilho
    label: string;
    emoji: string;
    hint: string;
  }
> = {
  // As cores dos blobs do fundo não vivem mais aqui: são customizáveis
  // pela tab /admin/blobs e lidas do Redis via getBlobTheme() (defaults
  // em src/lib/blob-theme.ts).
  OPEN: {
    glow: "#69ffa0",
    glowDim: "#00ff5e",
    label: "ABERTO",
    emoji: "🟢",
    hint: "Alguém confirmou que o CA está aberto!",
  },
  CLOSED: {
    glow: "#dc6a6a",
    glowDim: "#ff0000",
    label: "FECHADO",
    emoji: "🔴",
    hint: "Abriram o CA? Confirme pelo QR Code lá dentro!",
  },
};

// Tags de busca do GIF por estado (Seção 4 do SDD: feedback visual
// instantâneo e amigável). "rating=g" em getRandomGif já filtra
// conteúdo explícito/violento/pornográfico na origem.
const GIF_TAG: Record<CaStatus, string> = {
  OPEN: "thumbs up",
  CLOSED: "thumbs down",
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
  // maybeAutoClose devolve o estado vigente E aplica o fechamento
  // automático noturno "preguiçoso" (regra completa em lib/auto-close.ts):
  // como o Hobby só permite cron 1x/dia, as checagens de hora em hora da
  // madrugada acontecem aqui, pegando carona na regeneração ISR.
  const { state } = await maybeAutoClose();
  const [reports, gifUrl, blobTheme] = await Promise.all([
    getRecentReports(5),
    getRandomGif(GIF_TAG[state.current_status]),
    getBlobTheme(),
  ]);

  const theme = THEME[state.current_status];
  const blobs = blobTheme[state.current_status];
  const isOpen = state.current_status === "OPEN";

  // Sem cor de fundo no <main> de propósito: a base escura vive no body
  // (globals.css) pra não pintar por cima dos blobs de z-index negativo.
  return (
    <main
      className="flex min-h-dvh flex-col text-zinc-50"
      style={
        {
          "--blob-a": blobs.blobA,
          "--blob-b": blobs.blobB,
        } as React.CSSProperties
      }
    >
      {/* ── Fundo vivo: blobs de luz na cor do estado (decorativo).
          Fica numa camada fixa atrás de tudo; animação e blur em
          globals.css (.blob-field / .blob). ── */}
      <div className="blob-field" aria-hidden>
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>
      {/* ── Micro header: wordart do cacomp.xyz, só marca visual ── */}
      <header className="flex justify-center pt-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- GIF
            animado local; next/image não otimiza GIF (exigiria
            `unoptimized`) e pode quebrar a animação. */}
        <img
          src="/cacomp_xyz.gif"
          alt="cacomp.xyz"
          width={557}
          height={100}
          className="h-8 w-auto sm:h-12"
        />
      </header>
      {/* ── Bloco principal: o status domina a tela (mobile-first) ── */}
      <section className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest opacity-70">
          o CACOMP está:
        </p>

        {/* Tilt Neon inclinada em perspectiva via .status-font (XROT/YROT,
            ver globals.css) + efeito de placa de neon (núcleo claro +
            brilho externo em camadas, ver .neon-text). Sem utility de
            peso: a Tilt só tem 400, definido na própria .status-font. */}
        <h1
          className="neon-text status-font text-6xl sm:text-7xl"
          style={
            {
              "--neon-color": theme.glow,
              "--neon-color-dim": theme.glowDim,
            } as React.CSSProperties
          }
        >
          {theme.label}
        </h1>

        {gifUrl && (
          <div className="glass p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- GIF
                animado de domínio externo/variável (CDN do GIPHY);
                next/image exigiria remotePatterns amplo e pode quebrar a
                animação. */}
            <img
              src={gifUrl}
              alt={
                isOpen
                  ? "GIF de comemoração — polegar para cima"
                  : "GIF de decepção — polegar para baixo"
              }
              className="h-36 w-auto rounded-xl sm:h-44"
              loading="lazy"
            />
          </div>
        )}

        <p className="text-base opacity-80">
          Atualizado <TimeAgo iso={state.updated_at} />
        </p>

        <p className="mt-6 max-w-xs text-sm opacity-60">{theme.hint}</p>
      </section>

      {/* ── Feed de transparência: últimos 5 reportes anônimos, num
          painel de vidro sobre os blobs (a cor do estado atravessa o
          vidro vinda do fundo — o painel em si é neutro). ── */}
      <footer className="glass mx-4 mb-6 px-6 pb-6 pt-4 sm:mx-auto sm:w-full sm:max-w-xl">
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
                  {report.reporter_hash === AUTO_CLOSE_REPORTER_ID ? (
                    <>
                      Fechado <strong>automaticamente</strong> de madrugada
                    </>
                  ) : (
                    <>
                      Alguém reportou{" "}
                      <strong>
                        {report.action === "OPEN" ? "“Aberto”" : "“Fechado”"}
                      </strong>
                    </>
                  )}
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
