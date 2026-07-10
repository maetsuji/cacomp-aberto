import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { CaStatus } from "./types";
import { hashReporter, isRateLimited } from "./rate-limit";
import { setCaState } from "./status";
import { getReportTokens, isValidToken } from "./tokens";

export type ReportResult =
  | { ok: true; status: CaStatus }
  | { ok: false; reason: "invalid_token" | "rate_limited" };

/**
 * Processa um reporte vindo de um QR Code (Seção 2.2 do SDD).
 * Chamado APENAS pelo Route Handler GET /report — nunca durante o
 * render de uma página, pois `revalidatePath()` é proibido em render.
 *
 * 1. Valida o token contra o par rotacionável armazenado no Redis
 *    (lib/tokens.ts; fallback nas env vars) — tokens nunca chegam ao
 *    bundle do frontend, só existem por trás dos short links dos QRs.
 * 2. Aplica rate limiting por hash anônimo de IP.
 * 3. Persiste o novo estado + log anônimo no KV.
 * 4. Invalida o cache estático da Home (revalidatePath) — é isso que faz
 *    o ISR on-demand funcionar: a CDN volta a servir HTML fresco
 *    imediatamente após um reporte legítimo, sem polling nem SSR.
 */
export async function processReport(
  action: string | undefined,
  token: string | undefined
): Promise<ReportResult> {
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

  if (await isRateLimited(reporterHash)) {
    return { ok: false, reason: "rate_limited" };
  }

  const state = await setCaState(status, reporterHash);

  // Invalidação on-demand: derruba o cache da página inicial na CDN.
  revalidatePath("/");

  return { ok: true, status: state.current_status };
}
