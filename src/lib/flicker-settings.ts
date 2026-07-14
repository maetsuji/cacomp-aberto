export { FLICKER_LIMITS } from "./flicker-limits";
import { FLICKER_LIMITS } from "./flicker-limits";
import { storeAvailable, storeGetJson, storeSetJson } from "./store";

/* ── Parâmetros customizáveis do flicker de neon (texto ABERTO/FECHADO) ──
 *
 * A tab /admin/flicker permite ajustar velocidade/intensidade do efeito
 * sem redeploy. O valor vive no Redis e é lido pela Home a cada
 * regeneração ISR — salvar no admin chama revalidatePath("/"), mesmo
 * mecanismo do tema dos blobs (ver blob-theme.ts).
 *
 * Sem nada salvo (ou sem Redis, em dev local), valem os defaults abaixo. */

export interface FlickerSettings {
  enabled: boolean;
  onDuration: number; // segundos — duração do burst de "ligar"
  ambientInterval: number; // segundos — intervalo entre piscadas ambiente
  intensity: number; // 0–1 — profundidade das quedas de brilho
}

export const DEFAULT_FLICKER_SETTINGS: FlickerSettings = {
  enabled: true,
  onDuration: 1.6,
  ambientInterval: 13,
  intensity: 0.5,
};

const FLICKER_KEY = "ca:flicker-settings";

function clampNum(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function sanitize(stored: Partial<FlickerSettings> | null): FlickerSettings {
  if (!stored) return DEFAULT_FLICKER_SETTINGS;
  return {
    enabled:
      typeof stored.enabled === "boolean"
        ? stored.enabled
        : DEFAULT_FLICKER_SETTINGS.enabled,
    onDuration: clampNum(
      stored.onDuration,
      DEFAULT_FLICKER_SETTINGS.onDuration,
      FLICKER_LIMITS.onDuration.min,
      FLICKER_LIMITS.onDuration.max
    ),
    ambientInterval: clampNum(
      stored.ambientInterval,
      DEFAULT_FLICKER_SETTINGS.ambientInterval,
      FLICKER_LIMITS.ambientInterval.min,
      FLICKER_LIMITS.ambientInterval.max
    ),
    intensity: clampNum(
      stored.intensity,
      DEFAULT_FLICKER_SETTINGS.intensity,
      FLICKER_LIMITS.intensity.min,
      FLICKER_LIMITS.intensity.max
    ),
  };
}

/** Config vigente: a salva no Redis (campo a campo, validada) ou o default. */
export async function getFlickerSettings(): Promise<FlickerSettings> {
  if (!storeAvailable()) return DEFAULT_FLICKER_SETTINGS;
  const stored = await storeGetJson<Partial<FlickerSettings>>(FLICKER_KEY);
  return sanitize(stored);
}

export async function setFlickerSettings(
  settings: FlickerSettings
): Promise<void> {
  await storeSetJson(FLICKER_KEY, settings);
}

/** Volta ao default gravando null — getFlickerSettings trata como "nada salvo". */
export async function resetFlickerSettings(): Promise<void> {
  await storeSetJson(FLICKER_KEY, null);
}
