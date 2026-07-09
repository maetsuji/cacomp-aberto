import { AUTO_CLOSE_REPORTER_ID, getCaState, setCaState } from "./status";
import { storeAcquireLock } from "./store";
import type { CaState } from "./types";

/* ────────────────────── FECHAMENTO AUTOMÁTICO NOTURNO ──────────────────────
 *
 * O último horário de aula noturna da UnB termina às 22h30; com folga,
 * o CA fecha no máximo ~23h. Regra única que cobre todos os casos:
 *
 *   Fechar se: status == ABERTO
 *           E  hora em Brasília ∈ [00h, 07h)
 *           E  nenhum reporte de ABERTO na última hora.
 *
 * - À meia-noite (cron diário, vercel.json): um reporte de aberto entre
 *   23h e 00h conta como "tem gente lá" e o fechamento é adiado.
 * - Depois disso, a mesma regra é reavaliada de forma "preguiçosa" a
 *   cada regeneração da Home (ISR, revalidate=300): o plano Hobby da
 *   Vercel só permite cron 1x/dia, então as checagens de hora em hora
 *   acontecem aqui — o CA fecha na primeira regeneração após completar
 *   1h sem reporte de aberto, até as 7h.
 * - Sem spam: só há escrita (estado + 1 entrada no histórico) quando o
 *   fechamento de fato ocorre; um lock curto evita entradas duplicadas
 *   se duas regenerações concorrerem.
 * ──────────────────────────────────────────────────────────────────────── */

const WINDOW_END_HOUR = 7; // janela: [00h, 07h) em Brasília
const RECENT_OPEN_MS = 60 * 60 * 1000; // reporte de aberto há <1h segura o CA
const LOCK_KEY = "ca:auto-close-lock";
const LOCK_TTL_SECONDS = 5 * 60; // curto: só para deduplicar concorrência

function brasiliaHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hourCycle: "h23",
    }).format(date)
  );
}

export type AutoCloseResult = {
  state: CaState; // estado vigente após a avaliação (fresco em ambos os casos)
  closed: boolean;
  reason?:
    | "already_closed"
    | "outside_window"
    | "recent_open_report"
    | "concurrent_close";
};

/** Avalia a regra acima e fecha o CA se (e só se) todas as condições valem. */
export async function maybeAutoClose(now = new Date()): Promise<AutoCloseResult> {
  const state = await getCaState();

  if (state.current_status === "CLOSED") {
    return { state, closed: false, reason: "already_closed" };
  }
  if (brasiliaHour(now) >= WINDOW_END_HOUR) {
    return { state, closed: false, reason: "outside_window" };
  }
  if (now.getTime() - new Date(state.updated_at).getTime() < RECENT_OPEN_MS) {
    return { state, closed: false, reason: "recent_open_report" };
  }

  const acquired = await storeAcquireLock(LOCK_KEY, LOCK_TTL_SECONDS);
  if (!acquired) {
    return { state, closed: false, reason: "concurrent_close" };
  }

  const closedState = await setCaState("CLOSED", AUTO_CLOSE_REPORTER_ID);
  return { state: closedState, closed: true };
}
