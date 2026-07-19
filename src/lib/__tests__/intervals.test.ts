import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  brasiliaDateKey,
  getWeekIntervals,
  recordTransition,
  weekDates,
  type OpenInterval,
} from "../intervals";
import { storeSetJson } from "../store";

// Store mockado com um Map em memória: os testes exercitam o
// read-modify-write real do módulo, não só chamadas.
const { db } = vi.hoisted(() => ({ db: new Map<string, unknown>() }));

vi.mock("../store", () => ({
  storeAvailable: () => true,
  storeGetJson: vi.fn(async (key: string) => db.get(key) ?? null),
  storeSetJson: vi.fn(async (key: string, value: unknown) => {
    db.set(key, value);
  }),
}));

const mockedSet = vi.mocked(storeSetJson);

const OPEN_SINCE = "ca:intervals:open-since";

describe("intervals", () => {
  beforeEach(() => {
    db.clear();
    vi.clearAllMocks();
  });

  it("brasiliaDateKey converte UTC pro dia de Brasília (UTC-3)", () => {
    // 01:00Z do dia 16 ainda é 22h do dia 15 em Brasília
    expect(brasiliaDateKey(new Date("2026-07-16T01:00:00Z"))).toBe(
      "2026-07-15"
    );
    expect(brasiliaDateKey(new Date("2026-07-16T12:00:00Z"))).toBe(
      "2026-07-16"
    );
  });

  it("transição pra ABERTO só marca open-since, sem materializar nada", async () => {
    await recordTransition("OPEN", new Date("2026-07-15T15:00:00Z"));
    expect(db.get(OPEN_SINCE)).toBe("2026-07-15T15:00:00.000Z");
    expect([...db.keys()]).toEqual([OPEN_SINCE]);
  });

  it("fechar no mesmo dia materializa um intervalo com TTL e limpa open-since", async () => {
    await recordTransition("OPEN", new Date("2026-07-15T15:00:00Z")); // 12h BRT
    await recordTransition("CLOSED", new Date("2026-07-15T18:00:00Z")); // 15h BRT

    const intervals = db.get("ca:intervals:2026-07-15") as OpenInterval[];
    expect(intervals).toEqual([
      { o: "2026-07-15T15:00:00.000Z", c: "2026-07-15T18:00:00.000Z" },
    ]);
    expect(db.get(OPEN_SINCE)).toBeNull();

    const ttlCall = mockedSet.mock.calls.find(
      ([key]) => key === "ca:intervals:2026-07-15"
    );
    expect(ttlCall?.[2]).toBe(90 * 86_400);
  });

  it("intervalo que cruza a meia-noite de Brasília é fatiado por dia", async () => {
    // aberto 22h BRT do dia 15, fechado 02h BRT do dia 16
    await recordTransition("OPEN", new Date("2026-07-16T01:00:00Z"));
    await recordTransition("CLOSED", new Date("2026-07-16T05:00:00Z"));

    expect(db.get("ca:intervals:2026-07-15")).toEqual([
      { o: "2026-07-16T01:00:00.000Z", c: "2026-07-16T03:00:00.000Z" },
    ]);
    expect(db.get("ca:intervals:2026-07-16")).toEqual([
      { o: "2026-07-16T03:00:00.000Z", c: "2026-07-16T05:00:00.000Z" },
    ]);
  });

  it("fechar sem abertura registrada não grava intervalo nenhum", async () => {
    await recordTransition("CLOSED", new Date("2026-07-15T18:00:00Z"));
    expect(
      [...db.keys()].filter((key) => key !== OPEN_SINCE)
    ).toEqual([]);
  });

  it("weekDates devolve dom→sáb da semana de Brasília", () => {
    // 2026-07-15 é uma quarta-feira
    const dates = weekDates(new Date("2026-07-15T12:00:00Z"));
    expect(dates).toEqual([
      "2026-07-12",
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
      "2026-07-18",
    ]);
  });

  it("getWeekIntervals sintetiza o período aberto em andamento sem persistir", async () => {
    const now = new Date("2026-07-15T18:00:00Z");
    await recordTransition("OPEN", new Date("2026-07-15T15:00:00Z"));

    const { days, openSince } = await getWeekIntervals(now);
    expect(openSince).toBe("2026-07-15T15:00:00.000Z");

    const today = days.find((day) => day.date === "2026-07-15");
    expect(today?.intervals).toEqual([
      { o: "2026-07-15T15:00:00.000Z", c: "2026-07-15T18:00:00.000Z" },
    ]);
    // nada materializado no Redis além do open-since
    expect([...db.keys()]).toEqual([OPEN_SINCE]);
  });
});
