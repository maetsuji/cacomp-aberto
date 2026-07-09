"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { CaStatus } from "./types";
import { hashReporter, isRateLimited } from "./rate-limit";
import { setCaState } from "./status";

export type ReportResult =
  | { ok: true; status: CaStatus }
  | { ok: false; reason: "invalid_token" | "rate_limited" };

/**
 * Processa um reporte vindo de um QR Code (Seção 2.2 do SDD).
 *
 * 1. Valida o token estático contra as variáveis de ambiente — os tokens
 *    nunca chegam ao bundle do frontend, só existem no QR impresso.
 * 2. Aplica rate limiting por hash anônimo de IP (1 reporte / 20 min).
 * 3. Persiste o novo estado + log anônimo no KV.
 * 4. Invalida o cache estático da Home (revalidatePath) — é isso que faz
 *    o ISR on-demand funcionar: a CDN volta a servir HTML fresco
 *    imediatamente após um reporte legítimo, sem polling nem SSR.
 */
export async function processReport(
  action: string | undefined,
  token: string | undefined
): Promise<ReportResult> {
  const expected: Record<string, { token: string | undefined; status: CaStatus }> = {
    open: { token: process.env.REPORT_TOKEN_INTERNAL, status: "OPEN" },
    close: { token: process.env.REPORT_TOKEN_EXTERNAL, status: "CLOSED" },
  };

  const rule = action ? expected[action] : undefined;
  if (!rule || !rule.token || token !== rule.token) {
    return { ok: false, reason: "invalid_token" };
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const reporterHash = hashReporter(ip);

  if (await isRateLimited(reporterHash)) {
    return { ok: false, reason: "rate_limited" };
  }

  const state = await setCaState(rule.status, reporterHash);

  // Invalidação on-demand: derruba o cache da página inicial na CDN.
  revalidatePath("/");

  return { ok: true, status: state.current_status };
}
