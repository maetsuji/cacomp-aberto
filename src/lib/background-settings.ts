export { BACKGROUND_LIMITS } from "./background-limits";
import { BACKGROUND_LIMITS } from "./background-limits";
import { storeAvailable, storeGetJson, storeSetJson } from "./store";

/* ── Fundo de tijolo (textura atrás dos blobs) ──
 *
 * A tab /admin/aparencia permite ligar/desligar a textura de tijolo
 * (public/brick-texture.webp) e ajustar a opacidade do véu escuro por
 * cima dela, sem redeploy. O valor vive no Redis e é lido pela Home a
 * cada regeneração ISR — salvar no admin chama revalidatePath("/"),
 * mesmo mecanismo do tema dos blobs e do flicker.
 *
 * Sem nada salvo (ou sem Redis, em dev local), valem os defaults abaixo. */

export interface BackgroundSettings {
  enabled: boolean;
  overlayOpacity: number; // 0–1 — quanto mais alto, mais escuro/menos tijolo aparece
}

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  enabled: true,
  overlayOpacity: 0.85,
};

const BACKGROUND_KEY = "ca:background-settings";

function clampNum(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function sanitize(
  stored: Partial<BackgroundSettings> | null
): BackgroundSettings {
  if (!stored) return DEFAULT_BACKGROUND_SETTINGS;
  return {
    enabled:
      typeof stored.enabled === "boolean"
        ? stored.enabled
        : DEFAULT_BACKGROUND_SETTINGS.enabled,
    overlayOpacity: clampNum(
      stored.overlayOpacity,
      DEFAULT_BACKGROUND_SETTINGS.overlayOpacity,
      BACKGROUND_LIMITS.overlayOpacity.min,
      BACKGROUND_LIMITS.overlayOpacity.max
    ),
  };
}

/** Config vigente: a salva no Redis (campo a campo, validada) ou o default. */
export async function getBackgroundSettings(): Promise<BackgroundSettings> {
  if (!storeAvailable()) return DEFAULT_BACKGROUND_SETTINGS;
  const stored = await storeGetJson<Partial<BackgroundSettings>>(
    BACKGROUND_KEY
  );
  return sanitize(stored ?? null);
}

export async function setBackgroundSettings(
  settings: BackgroundSettings
): Promise<void> {
  await storeSetJson(BACKGROUND_KEY, settings);
}

/** Volta ao default gravando null — getBackgroundSettings trata como "nada salvo". */
export async function resetBackgroundSettings(): Promise<void> {
  await storeSetJson(BACKGROUND_KEY, null);
}
