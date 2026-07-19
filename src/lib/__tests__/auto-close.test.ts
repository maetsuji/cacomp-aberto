import { beforeEach, describe, expect, it, vi } from "vitest";
import { maybeAutoClose } from "../auto-close";
import { AUTO_CLOSE_REPORTER_ID, getCaState, setCaState } from "../status";
import { storeAcquireLock } from "../store";

vi.mock("../status", () => ({
  AUTO_CLOSE_REPORTER_ID: "system:auto-midnight",
  getCaState: vi.fn(),
  setCaState: vi.fn(),
}));
vi.mock("../store", () => ({
  storeAcquireLock: vi.fn(),
}));

const mockedGetState = vi.mocked(getCaState);
const mockedSetState = vi.mocked(setCaState);
const mockedLock = vi.mocked(storeAcquireLock);

// Brasília = UTC-3: 05:00Z = 02h (dentro da janela [00h,07h)),
// 12:00Z = 09h (fora), 10:00Z = 07h em ponto (fora, janela é exclusiva).
const IN_WINDOW = new Date("2026-07-15T05:00:00Z");
const OUTSIDE_WINDOW = new Date("2026-07-15T12:00:00Z");
const WINDOW_EDGE = new Date("2026-07-15T10:00:00Z");

function openSince(hoursAgo: number, now: Date) {
  return {
    current_status: "OPEN" as const,
    updated_at: new Date(now.getTime() - hoursAgo * 3600_000).toISOString(),
  };
}

describe("maybeAutoClose", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("não faz nada se já está fechado", async () => {
    mockedGetState.mockResolvedValue({
      current_status: "CLOSED",
      updated_at: new Date(0).toISOString(),
    });
    const result = await maybeAutoClose(IN_WINDOW);
    expect(result).toMatchObject({ closed: false, reason: "already_closed" });
    expect(mockedSetState).not.toHaveBeenCalled();
  });

  it("não fecha fora da janela [00h,07h) de Brasília", async () => {
    mockedGetState.mockResolvedValue(openSince(5, OUTSIDE_WINDOW));
    const result = await maybeAutoClose(OUTSIDE_WINDOW);
    expect(result).toMatchObject({ closed: false, reason: "outside_window" });
  });

  it("às 07h em ponto já está fora da janela", async () => {
    mockedGetState.mockResolvedValue(openSince(5, WINDOW_EDGE));
    const result = await maybeAutoClose(WINDOW_EDGE);
    expect(result).toMatchObject({ closed: false, reason: "outside_window" });
  });

  it("reporte de aberto há menos de 1h segura o CA", async () => {
    mockedGetState.mockResolvedValue(openSince(0.5, IN_WINDOW));
    const result = await maybeAutoClose(IN_WINDOW);
    expect(result).toMatchObject({
      closed: false,
      reason: "recent_open_report",
    });
    expect(mockedLock).not.toHaveBeenCalled();
  });

  it("não duplica o fechamento quando outro processo tem o lock", async () => {
    mockedGetState.mockResolvedValue(openSince(3, IN_WINDOW));
    mockedLock.mockResolvedValue(false);
    const result = await maybeAutoClose(IN_WINDOW);
    expect(result).toMatchObject({ closed: false, reason: "concurrent_close" });
    expect(mockedSetState).not.toHaveBeenCalled();
  });

  it("fecha quando todas as condições valem", async () => {
    mockedGetState.mockResolvedValue(openSince(3, IN_WINDOW));
    mockedLock.mockResolvedValue(true);
    mockedSetState.mockResolvedValue({
      current_status: "CLOSED",
      updated_at: IN_WINDOW.toISOString(),
    });

    const result = await maybeAutoClose(IN_WINDOW);
    expect(result.closed).toBe(true);
    expect(mockedSetState).toHaveBeenCalledWith(
      "CLOSED",
      AUTO_CLOSE_REPORTER_ID
    );
  });
});
