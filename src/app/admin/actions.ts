"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BACKGROUND_LIMITS,
  DEFAULT_BACKGROUND_SETTINGS,
  resetBackgroundSettings,
  setBackgroundSettings,
} from "@/lib/background-settings";
import { HEX_COLOR, resetBlobTheme, setBlobTheme } from "@/lib/blob-theme";
import {
  DEFAULT_FLICKER_SETTINGS,
  FLICKER_LIMITS,
  resetFlickerSettings,
  setFlickerSettings,
} from "@/lib/flicker-settings";
import { isGeofenceEnabled, setGeofenceEnabled } from "@/lib/geofence";
import {
  isRateLimitDisabled,
  setDeviceRateLimitMinutes,
  setRateLimitDisabled,
} from "@/lib/rate-limit";
import {
  DEFAULT_RATE_LIMIT_WINDOW_MINUTES,
  RATE_LIMIT_WINDOW_LIMITS,
} from "@/lib/rate-limit-limits";
import { rotateAndSync } from "@/lib/rotate";
import { syncShortLinks } from "@/lib/shortlink";
import { getReportTokens } from "@/lib/tokens";

// Server Actions do /admin. O middleware de Basic Auth cobre também os
// POSTs dessas actions (mesmo path /admin).

export async function rotateNowAction() {
  const result = await rotateAndSync({ force: true });
  revalidatePath("/admin");

  const msg = result.rotated
    ? result.errors.length > 0
      ? `Tokens rotacionados, com avisos: ${result.errors.join("; ")}`
      : "Tokens rotacionados e short links atualizados."
    : `Rotação NÃO aplicada (tokens antigos preservados): ${result.errors.join("; ")}`;

  redirect(`/admin?msg=${encodeURIComponent(msg)}`);
}

/** Liga/desliga a verificação de localização (geofence) dos reportes. */
export async function toggleGeofenceAction() {
  const current = await isGeofenceEnabled();
  await setGeofenceEnabled(!current);
  revalidatePath("/admin");

  const msg = !current
    ? "Verificação de localização LIGADA — reportes agora exigem GPS perto do CA."
    : "Verificação de localização DESLIGADA — reportes voltam a não exigir GPS.";

  redirect(`/admin?msg=${encodeURIComponent(msg)}`);
}

/**
 * Salva as cores dos blobs escolhidas em /admin/blobs e revalida a Home
 * na hora — todo visitante passa a ver as novas cores (a Home é ISR e
 * relê o tema do Redis a cada regeneração).
 */
export async function saveBlobThemeAction(formData: FormData) {
  const read = (name: string): string | null => {
    const value = String(formData.get(name) ?? "")
      .trim()
      .toLowerCase();
    return HEX_COLOR.test(value) ? value : null;
  };

  const openA = read("openA");
  const openB = read("openB");
  const closedA = read("closedA");
  const closedB = read("closedB");

  if (!openA || !openB || !closedA || !closedB) {
    redirect(
      `/admin/aparencia?msg=${encodeURIComponent(
        "Cor inválida — use o formato #rrggbb em todos os campos."
      )}`
    );
  }

  await setBlobTheme({
    OPEN: { blobA: openA, blobB: openB },
    CLOSED: { blobA: closedA, blobB: closedB },
  });
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/admin/aparencia");

  redirect(
    `/admin/aparencia?msg=${encodeURIComponent(
      "Cores salvas — a Home já mostra o novo fundo para todo mundo."
    )}`
  );
}

/** Apaga o tema salvo e volta às cores padrão do design. */
export async function resetBlobThemeAction() {
  await resetBlobTheme();
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/admin/aparencia");

  redirect(
    `/admin/aparencia?msg=${encodeURIComponent(
      "Cores restauradas para o padrão do design."
    )}`
  );
}

/**
 * Salva os parâmetros do flicker de neon escolhidos em /admin/flicker e
 * revalida a Home na hora (mesmo mecanismo do tema dos blobs).
 */
export async function saveFlickerSettingsAction(formData: FormData) {
  const readNum = (name: string, min: number, max: number, fallback: number): number => {
    const n = Number(formData.get(name));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  await setFlickerSettings({
    enabled: formData.get("enabled") === "on",
    onDuration: readNum(
      "onDuration",
      FLICKER_LIMITS.onDuration.min,
      FLICKER_LIMITS.onDuration.max,
      DEFAULT_FLICKER_SETTINGS.onDuration
    ),
    ambientInterval: readNum(
      "ambientInterval",
      FLICKER_LIMITS.ambientInterval.min,
      FLICKER_LIMITS.ambientInterval.max,
      DEFAULT_FLICKER_SETTINGS.ambientInterval
    ),
    intensity: readNum(
      "intensity",
      FLICKER_LIMITS.intensity.min,
      FLICKER_LIMITS.intensity.max,
      DEFAULT_FLICKER_SETTINGS.intensity
    ),
  });
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/admin/aparencia");

  redirect(
    `/admin/aparencia?msg=${encodeURIComponent(
      "Parâmetros do flicker salvos — a Home já usa os novos valores para todo mundo."
    )}`
  );
}

/** Apaga a config salva e volta aos parâmetros padrão do flicker. */
export async function resetFlickerSettingsAction() {
  await resetFlickerSettings();
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/admin/aparencia");

  redirect(
    `/admin/aparencia?msg=${encodeURIComponent(
      "Flicker restaurado para os parâmetros padrão."
    )}`
  );
}

/**
 * Salva as configs do fundo de tijolo escolhidas em /admin/aparencia e
 * revalida a Home na hora (mesmo mecanismo dos blobs e do flicker).
 */
export async function saveBackgroundSettingsAction(formData: FormData) {
  const readNum = (name: string, min: number, max: number, fallback: number): number => {
    const n = Number(formData.get(name));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  await setBackgroundSettings({
    enabled: formData.get("enabled") === "on",
    overlayOpacity: readNum(
      "overlayOpacity",
      BACKGROUND_LIMITS.overlayOpacity.min,
      BACKGROUND_LIMITS.overlayOpacity.max,
      DEFAULT_BACKGROUND_SETTINGS.overlayOpacity
    ),
  });
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/admin/aparencia");

  redirect(
    `/admin/aparencia?msg=${encodeURIComponent(
      "Fundo de tijolo salvo — a Home já usa a nova config para todo mundo."
    )}`
  );
}

/** Apaga a config salva e volta aos parâmetros padrão do fundo de tijolo. */
export async function resetBackgroundSettingsAction() {
  await resetBackgroundSettings();
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/admin/aparencia");

  redirect(
    `/admin/aparencia?msg=${encodeURIComponent(
      "Fundo de tijolo restaurado para o padrão."
    )}`
  );
}

/** Salva a duração da janela do rate-limit por device (slider em /admin). */
export async function saveRateLimitWindowAction(formData: FormData) {
  const n = Number(formData.get("windowMinutes"));
  const minutes = Number.isFinite(n)
    ? Math.min(
        RATE_LIMIT_WINDOW_LIMITS.minutes.max,
        Math.max(RATE_LIMIT_WINDOW_LIMITS.minutes.min, n)
      )
    : DEFAULT_RATE_LIMIT_WINDOW_MINUTES;

  await setDeviceRateLimitMinutes(minutes);
  revalidatePath("/admin");

  redirect(
    `/admin?msg=${encodeURIComponent(
      `Janela do rate limit ajustada para ${minutes} min por dispositivo.`
    )}`
  );
}

/** Liga/desliga o rate-limit por device/IP dos reportes (uso: testes). */
export async function toggleRateLimitAction() {
  const current = await isRateLimitDisabled();
  await setRateLimitDisabled(!current);
  revalidatePath("/admin");

  const msg = !current
    ? "Rate limit DESLIGADO — reportes seguidos não são mais bloqueados (só para testes)."
    : "Rate limit LIGADO — reportes voltam a respeitar os limites normais.";

  redirect(`/admin?msg=${encodeURIComponent(msg)}`);
}

/** Recria/atualiza os short links para os tokens ATUAIS, sem rotacionar. */
export async function syncLinksAction() {
  const tokens = await getReportTokens();
  const { errors } = await syncShortLinks(tokens);
  revalidatePath("/admin");

  const msg =
    errors.length > 0
      ? `Sincronização com erros: ${errors.join("; ")}`
      : "Short links sincronizados com os tokens atuais.";

  redirect(`/admin?msg=${encodeURIComponent(msg)}`);
}
