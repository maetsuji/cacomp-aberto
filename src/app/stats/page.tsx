import type { Metadata } from "next";
import { Link } from "next-view-transitions";
import { getBackgroundSettings } from "@/lib/background-settings";
import { getBlobTheme } from "@/lib/blob-theme";
import { getFlickerSettings } from "@/lib/flicker-settings";
import { getCaState } from "@/lib/status";
import {
  brasiliaDateKey,
  getWeekIntervals,
  type OpenInterval,
} from "@/lib/intervals";

/* ── Histórico da semana ──
 *
 * Gráfico da semana vigente (dom→sáb): cada dia é uma barra de 24h em
 * cinza-vinho escuro (fechado) com janelas VERDES nos períodos em que o
 * CA esteve aberto. Os dados vêm de ca:intervals:* (lib/intervals.ts),
 * alimentados pelo despachante de transições.
 *
 * Mesma estratégia de cache da Home: ISR como rede de segurança +
 * revalidatePath("/stats") on-demand no processReport. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Histórico — CA Aberto? · CACOMP UnB",
  description: "Horários em que o CACOMP esteve aberto nesta semana.",
};

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CLOSED_BG = "#2a1e24"; // cinza-vinho escuro (fechado)
const OPEN_BG = "#22c55e";
const DAY_MS = 86_400_000;

/** Início do dia de Brasília (UTC-3 fixo) a partir da chave YYYY-MM-DD. */
const dayStartMs = (date: string) =>
  new Date(`${date}T00:00:00-03:00`).getTime();

/** Posição percentual de um instante dentro do dia de Brasília. */
function dayPercent(iso: string, date: string): number {
  const pct = ((new Date(iso).getTime() - dayStartMs(date)) / DAY_MS) * 100;
  return Math.min(100, Math.max(0, pct));
}

function formatRange(interval: OpenInterval): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  return `aberto ${fmt(interval.o)}–${fmt(interval.c)}`;
}

export default async function StatsPage() {
  const now = new Date();
  const [{ days }, background, flicker, blobTheme, state] = await Promise.all([
    getWeekIntervals(now),
    getBackgroundSettings(),
    getFlickerSettings(),
    getBlobTheme(),
    getCaState(),
  ]);

  const todayKey = brasiliaDateKey(now);
  const nowPercent = dayPercent(now.toISOString(), todayKey);
  const hasData = days.some((day) => day.intervals.length > 0);
  // Blobs na cor do estado atual, como na Home — o verde/vermelho
  // atravessa o vidro do gráfico vindo do fundo.
  const blobs = blobTheme[state.current_status];

  return (
    <main
      className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8 text-zinc-50"
      style={
        {
          "--blob-a": blobs.blobA,
          "--blob-b": blobs.blobB,
        } as React.CSSProperties
      }
    >
      {/* Mesmo fundo de tijolo da Home (classes globais de globals.css;
          opacidade do véu vem do Redis via /admin/aparencia). */}
      {background.enabled && (
        <>
          <div className="brick-bg" aria-hidden />
          <div
            className="brick-overlay"
            aria-hidden
            style={
              {
                "--bg-overlay-opacity": background.overlayOpacity,
              } as React.CSSProperties
            }
          />
        </>
      )}
      <div className="blob-field" aria-hidden>
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          {/* Mesma placa de neon da Home, herdando o flicker configurado */}
          <h1
            className={`neon-text status-font text-3xl${
              flicker.enabled ? " neon-flicker" : ""
            }`}
            style={
              {
                "--neon-color": "#ffffe6",
                "--neon-color-dim": "#f4cec5",
                "--flicker-on-duration": `${flicker.onDuration}s`,
                "--flicker-ambient-duration": `${flicker.ambientInterval}s`,
                "--flicker-intensity": flicker.intensity,
              } as React.CSSProperties
            }
          >
            HISTÓRICO
          </h1>
          <p className="text-sm opacity-60">
            Quando que o CACOMP esteve aberto nesta semana?
          </p>
        </div>

        {/* Voltar em liquid glass redondo, à direita (zona do polegar;
            44x44 = alvo de toque acessível). borderRadius inline: no
            Tailwind v4 o rounded-full (em layer) perde pro
            border-radius da .glass, que é CSS sem layer. */}
        <Link
          href="/"
          aria-label="Voltar para a página inicial"
          className="glass flex h-11 w-11 shrink-0 items-center justify-center text-lg hover:opacity-80"
          style={{ borderRadius: "9999px" }}
        >
          ←
        </Link>
      </header>

      <section className="glass space-y-3 px-5 pb-5 pt-4">
        {/* Régua de horas alinhada com as barras (coluna do rótulo à esquerda) */}
        <div className="flex items-center gap-3 text-[10px] tabular-nums opacity-40">
          <span className="w-10 shrink-0" />
          <div className="relative h-4 flex-1">
            {[0, 6, 12, 18, 24].map((hour) => (
              <span
                key={hour}
                className="absolute -translate-x-1/2"
                style={{ left: `${(hour / 24) * 100}%` }}
              >
                {String(hour).padStart(2, "0")}h
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {days.map((day, i) => {
            const isToday = day.date === todayKey;
            const isFuture = day.date > todayKey;
            return (
              <div
                key={day.date}
                className={`flex items-center gap-3 ${isFuture ? "opacity-35" : ""}`}
              >
                <span
                  className={`w-10 shrink-0 text-xs ${
                    isToday ? "font-bold text-green-300" : "opacity-70"
                  }`}
                >
                  {WEEKDAY_LABELS[i]}
                </span>

                <div
                  className={`relative h-7 flex-1 overflow-hidden rounded-md ${
                    isToday ? "ring-1 ring-green-400/40" : ""
                  }`}
                  style={{ backgroundColor: CLOSED_BG }}
                  title={
                    day.intervals.length > 0
                      ? day.intervals.map(formatRange).join(" · ")
                      : "sem registro de abertura"
                  }
                >
                  {day.intervals.map((interval) => {
                    const left = dayPercent(interval.o, day.date);
                    const width =
                      dayPercent(interval.c, day.date) - left;
                    return (
                      <div
                        key={interval.o}
                        className="absolute inset-y-0 rounded-sm"
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 0.4)}%`,
                          backgroundColor: OPEN_BG,
                          boxShadow: `0 0 8px ${OPEN_BG}b0`,
                        }}
                      />
                    );
                  })}

                  {isToday && (
                    <div
                      className="absolute inset-y-0 w-px bg-zinc-50/70"
                      style={{ left: `${nowPercent}%` }}
                      aria-hidden
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 pt-1 text-xs opacity-60">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: OPEN_BG }}
            />
            aberto
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: CLOSED_BG }}
            />
            fechado
          </span>
          <span className="ml-auto">semana de {days[0].date.slice(8)}/{days[0].date.slice(5, 7)} a {days[6].date.slice(8)}/{days[6].date.slice(5, 7)}</span>
        </div>

        {!hasData && (
          <p className="pt-2 text-sm opacity-50">
            Ainda não há registros de abertura nesta semana — as janelas
            aparecem aqui conforme o CA abre e fecha.
          </p>
        )}
      </section>

      <p className="text-center text-xs opacity-40">
        Derivado dos reportes anônimos · registros mantidos por 90 dias
      </p>
    </main>
  );
}
