import { storeAvailable, storeGetJson, storeSetJson } from "./store";
import type { CaStatus } from "./types";

/* ── Intervalos de abertura (base do /stats e do export CSV) ──
 *
 * ca:history guarda só os últimos 20 reportes — insuficiente pra
 * reconstruir a semana. Aqui gravamos os PERÍODOS em que o CA esteve
 * aberto, um registro por dia de Brasília:
 *
 *   ca:intervals:{YYYY-MM-DD} -> [{ o: iso, c: iso }, ...]   (TTL 90d)
 *   ca:intervals:open-since   -> iso da transição pra ABERTO vigente
 *
 * Na transição pra ABERTO só marcamos open-since; na transição pra
 * FECHADO materializamos o intervalo, FATIANDO na meia-noite de
 * Brasília se cruzar o dia (cada dia do gráfico enxerga só os próprios
 * segmentos). Enquanto aberto, o segmento "ao vivo" é sintetizado na
 * leitura a partir de open-since — nada é persistido até fechar.
 *
 * Brasília é UTC-3 fixo (o Brasil aboliu o horário de verão em 2019),
 * então a aritmética de dia usa offset constante — igual à premissa do
 * resto do app (auto-close.ts). Sem Redis: tudo no-op/vazio (fail-open). */

export interface OpenInterval {
  o: string; // ISO de abertura (dentro do dia)
  c: string; // ISO de fechamento (dentro do dia; fim do dia se fatiado)
}

export interface DayIntervals {
  date: string; // YYYY-MM-DD (dia de Brasília)
  intervals: OpenInterval[];
}

const OPEN_SINCE_KEY = "ca:intervals:open-since";
const INTERVAL_TTL_SECONDS = 90 * 86_400;
const BRT_OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;

const intervalKey = (date: string) => `ca:intervals:${date}`;

/** ms da época no "relógio de Brasília" (UTC-3 fixo). */
const brtMs = (date: Date) => date.getTime() - BRT_OFFSET_MS;

/** Dia de Brasília (YYYY-MM-DD) que contém o instante. */
export function brasiliaDateKey(date: Date): string {
  return new Date(brtMs(date)).toISOString().slice(0, 10);
}

/** Instante UTC da meia-noite de Brasília do dia que contém `date`. */
function brtDayStartUtc(date: Date): Date {
  return new Date(Math.floor(brtMs(date) / DAY_MS) * DAY_MS + BRT_OFFSET_MS);
}

/** Fatia [open, close) em segmentos por dia de Brasília. */
function materialize(
  open: Date,
  close: Date
): Array<{ date: string; o: string; c: string }> {
  const segments: Array<{ date: string; o: string; c: string }> = [];
  let cursor = open;

  while (
    brasiliaDateKey(cursor) !== brasiliaDateKey(close) &&
    segments.length < 90 // trava de segurança contra open-since podre
  ) {
    const nextDayStart = new Date(brtDayStartUtc(cursor).getTime() + DAY_MS);
    segments.push({
      date: brasiliaDateKey(cursor),
      o: cursor.toISOString(),
      c: nextDayStart.toISOString(),
    });
    cursor = nextDayStart;
  }

  segments.push({
    date: brasiliaDateKey(cursor),
    o: cursor.toISOString(),
    c: close.toISOString(),
  });
  return segments;
}

/** Chamado pelo despachante de transições (on-transition.ts). */
export async function recordTransition(
  status: CaStatus,
  at: Date
): Promise<void> {
  if (!storeAvailable()) return;

  if (status === "OPEN") {
    await storeSetJson(OPEN_SINCE_KEY, at.toISOString());
    return;
  }

  const openIso = await storeGetJson<string>(OPEN_SINCE_KEY);
  if (!openIso) return; // fechado sem abertura registrada: nada a materializar

  const open = new Date(openIso);
  if (Number.isNaN(open.getTime()) || open.getTime() >= at.getTime()) {
    await storeSetJson(OPEN_SINCE_KEY, null);
    return;
  }

  for (const segment of materialize(open, at)) {
    const key = intervalKey(segment.date);
    const existing = (await storeGetJson<OpenInterval[]>(key)) ?? [];
    existing.push({ o: segment.o, c: segment.c });
    await storeSetJson(key, existing, INTERVAL_TTL_SECONDS);
  }

  await storeSetJson(OPEN_SINCE_KEY, null);
}

/** Datas (YYYY-MM-DD) de domingo a sábado da semana de Brasília de `now`. */
export function weekDates(now: Date): string[] {
  const todayStart = brtDayStartUtc(now);
  const dow = new Date(brtMs(now)).getUTCDay(); // 0 = domingo
  const sundayStart = todayStart.getTime() - dow * DAY_MS;
  return Array.from({ length: 7 }, (_, i) =>
    brasiliaDateKey(new Date(sundayStart + i * DAY_MS + 1))
  );
}

/**
 * Intervalos da semana vigente (dom→sáb), incluindo o período aberto em
 * andamento (sintetizado de open-since até `now`, sem persistir).
 */
export async function getWeekIntervals(now = new Date()): Promise<{
  days: DayIntervals[];
  openSince: string | null;
}> {
  const dates = weekDates(now);

  if (!storeAvailable()) {
    return {
      days: dates.map((date) => ({ date, intervals: [] })),
      openSince: null,
    };
  }

  const openSince = await storeGetJson<string>(OPEN_SINCE_KEY);
  const lists = await Promise.all(
    dates.map((date) => storeGetJson<OpenInterval[]>(intervalKey(date)))
  );

  const byDate = new Map<string, OpenInterval[]>(
    dates.map((date, i) => [date, [...(lists[i] ?? [])]])
  );

  if (openSince) {
    const open = new Date(openSince);
    if (!Number.isNaN(open.getTime()) && open.getTime() < now.getTime()) {
      for (const segment of materialize(open, now)) {
        byDate.get(segment.date)?.push({ o: segment.o, c: segment.c });
      }
    }
  }

  return {
    days: dates.map((date) => ({ date, intervals: byDate.get(date) ?? [] })),
    openSince: openSince ?? null,
  };
}
