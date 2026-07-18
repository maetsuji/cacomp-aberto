import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { CaStatus } from "./types";
import { isGeofenceEnabled, isWithinGeofence } from "./geofence";
import {
  hashReporter,
  isDeviceRateLimited,
  isIpFlooding,
  isRateLimitDisabled,
} from "./rate-limit";
import { setCaState } from "./status";
import { storeIncrWithTTL } from "./store";
import { getReportTokens, isValidToken } from "./tokens";

export type ReportResult =
  | { ok: true; status: CaStatus }
  | {
      ok: false;
      reason:
        | "invalid_token"
        | "device_rate_limited"
        | "ip_flooding"
        | "daily_cap"
        | "outside_geofence";
    };

const DAILY_CAP = Number(process.env.REPORT_DAILY_CAP ?? 500);

/**
 * Processa um reporte vindo de um QR Code/tag NFC (Seção 2.2 do SDD).
 * Chamado APENAS pelo Route Handler GET /report — nunca durante o
 * render de uma página, pois `revalidatePath()` é proibido em render.
 *
 * Ordem (do mais barato pro mais caro em leituras de Redis):
 * 1. Circuit breaker diário — protege a cota gratuita do Redis contra
 *    flood, roda ANTES até da leitura dos tokens. Sempre ativo, mesmo
 *    com o rate-limit desligado no /admin (passos 3-4 abaixo).
 * 2. Valida o token contra o par rotacionável no Redis (lib/tokens.ts).
 * 3. Teto frouxo de flood por IP (script sem cookies).
 * 4. Rate-limit estrito por dispositivo (cookie anônimo, ver route.ts) —
 *    substitui o antigo rate-limit por IP: numa wifi compartilhada,
 *    dispositivos diferentes não se bloqueiam mutuamente.
 *    Passos 3-4 podem ser desligados via toggle no /admin
 *    (lib/rate-limit.ts) pra testar vários reportes seguidos.
 * 5. Geofence por GPS, se ligado no /admin (lib/geofence.ts) — mitiga o
 *    problema do link estável, mas é um dissuasor, não prova inquebrável.
 * 6. Persiste o novo estado + log anônimo, invalida o cache da Home.
 */
export async function processReport(
  action: string | undefined,
  token: string | undefined,
  deviceId: string,
  coords?: { lat: number; lng: number }
): Promise<ReportResult> {
  const count = await storeIncrWithTTL("ca:report-count", 86400);
  if (count > DAILY_CAP) {
    return { ok: false, reason: "daily_cap" };
  }

  const STATUS_BY_ACTION: Record<string, CaStatus> = {
    open: "OPEN",
    close: "CLOSED",
  };

  const status = action ? STATUS_BY_ACTION[action] : undefined;
  if (!status) {
    return { ok: false, reason: "invalid_token" };
  }

  const tokens = await getReportTokens();
  if (!isValidToken(tokens, action as "open" | "close", token)) {
    return { ok: false, reason: "invalid_token" };
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const reporterHash = hashReporter(ip);

  if (!(await isRateLimitDisabled())) {
    if (await isIpFlooding(reporterHash)) {
      return { ok: false, reason: "ip_flooding" };
    }

    if (await isDeviceRateLimited(deviceId)) {
      return { ok: false, reason: "device_rate_limited" };
    }
  }

  if (await isGeofenceEnabled()) {
    if (!coords || !isWithinGeofence(coords.lat, coords.lng)) {
      return { ok: false, reason: "outside_geofence" };
    }
  }

  const state = await setCaState(status, reporterHash);

  // Invalidação on-demand: derruba o cache da página inicial na CDN.
  revalidatePath("/");

  return { ok: true, status: state.current_status };
}
