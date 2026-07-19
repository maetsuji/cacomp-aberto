import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BACKGROUND_SETTINGS,
  getBackgroundSettings,
} from "../background-settings";
import {
  DEFAULT_FLICKER_SETTINGS,
  getFlickerSettings,
} from "../flicker-settings";
import { storeAvailable, storeGetJson } from "../store";

vi.mock("../store", () => ({
  storeAvailable: vi.fn(),
  storeGetJson: vi.fn(),
  storeSetJson: vi.fn(),
}));

const mockedAvailable = vi.mocked(storeAvailable);
const mockedGet = vi.mocked(storeGetJson);

describe("sanitização das settings (getter valida campo a campo)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedAvailable.mockReturnValue(true);
  });

  it("sem store configurado, retorna os defaults sem tocar o Redis", async () => {
    mockedAvailable.mockReturnValue(false);
    await expect(getBackgroundSettings()).resolves.toEqual(
      DEFAULT_BACKGROUND_SETTINGS
    );
    await expect(getFlickerSettings()).resolves.toEqual(
      DEFAULT_FLICKER_SETTINGS
    );
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("null salvo (reset) vira default", async () => {
    mockedGet.mockResolvedValue(null);
    await expect(getBackgroundSettings()).resolves.toEqual(
      DEFAULT_BACKGROUND_SETTINGS
    );
    await expect(getFlickerSettings()).resolves.toEqual(
      DEFAULT_FLICKER_SETTINGS
    );
  });

  it("clampa opacidade fora da faixa 0–1", async () => {
    mockedGet.mockResolvedValue({ enabled: false, overlayOpacity: 7 });
    const settings = await getBackgroundSettings();
    expect(settings).toEqual({ enabled: false, overlayOpacity: 1 });
  });

  it("tipo errado em um campo cai no default daquele campo, sem perder os outros", async () => {
    mockedGet.mockResolvedValue({
      enabled: "sim",
      overlayOpacity: 0.3,
    });
    const settings = await getBackgroundSettings();
    expect(settings).toEqual({
      enabled: DEFAULT_BACKGROUND_SETTINGS.enabled,
      overlayOpacity: 0.3,
    });
  });

  it("flicker: NaN e valores fora da faixa são saneados campo a campo", async () => {
    mockedGet.mockResolvedValue({
      enabled: false,
      onDuration: Number.NaN,
      ambientInterval: 99999,
      intensity: -5,
    });
    const settings = await getFlickerSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.onDuration).toBe(DEFAULT_FLICKER_SETTINGS.onDuration);
    expect(settings.ambientInterval).toBeLessThanOrEqual(99999);
    expect(Number.isFinite(settings.ambientInterval)).toBe(true);
    expect(settings.intensity).toBeGreaterThanOrEqual(0);
  });
});
