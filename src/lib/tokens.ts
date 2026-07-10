import { randomBytes } from "crypto";
import { storeAvailable, storeGetJson, storeSetJson } from "./store";

/* ───────────────────────── TOKENS ROTACIONÁVEIS ─────────────────────────
 *
 * Os tokens de reporte vivem no Redis (não mais só em env vars) para
 * poderem ser rotacionados sem redeploy: os QR Codes impressos apontam
 * para short links (short.io), e a rotação atualiza o destino dos short
 * links — a imagem impressa nunca muda.
 *
 * As env vars REPORT_TOKEN_INTERNAL/EXTERNAL continuam valendo como
 * fallback (primeiro deploy, dev local sem Redis, ou antes da primeira
 * rotação), então nada quebra na migração.
 * ──────────────────────────────────────────────────────────────────── */

const TOKENS_KEY = "ca:report-tokens";

// Janela em que o token ANTERIOR ainda é aceito após uma rotação —
// cobre quem escaneou o QR segundos antes do short link ser atualizado.
const PREVIOUS_TOKEN_GRACE_MS = 15 * 60 * 1000;

export interface ReportTokens {
  open: string; // QR interno (reporta ABERTO)
  close: string; // QR externo (reporta FECHADO)
  previous_open?: string;
  previous_close?: string;
  rotated_at: string; // ISO 8601
}

function envTokens(): ReportTokens {
  return {
    open: process.env.REPORT_TOKEN_INTERNAL ?? "",
    close: process.env.REPORT_TOKEN_EXTERNAL ?? "",
    rotated_at: new Date(0).toISOString(),
  };
}

export async function getReportTokens(): Promise<ReportTokens> {
  if (!storeAvailable()) return envTokens();
  const stored = await storeGetJson<ReportTokens>(TOKENS_KEY);
  return stored ?? envTokens();
}

/** Valida um token, aceitando o anterior dentro da janela de graça. */
export function isValidToken(
  tokens: ReportTokens,
  action: "open" | "close",
  candidate: string | undefined
): boolean {
  if (!candidate) return false;

  const current = tokens[action];
  if (current && candidate === current) return true;

  const previous =
    action === "open" ? tokens.previous_open : tokens.previous_close;
  const withinGrace =
    Date.now() - new Date(tokens.rotated_at).getTime() <
    PREVIOUS_TOKEN_GRACE_MS;

  return Boolean(previous && withinGrace && candidate === previous);
}

/** Gera o par candidato de tokens novos (ainda NÃO persiste — ver rotate.ts). */
export function buildNextTokens(current: ReportTokens): ReportTokens {
  return {
    open: randomBytes(32).toString("hex"),
    close: randomBytes(32).toString("hex"),
    previous_open: current.open || undefined,
    previous_close: current.close || undefined,
    rotated_at: new Date().toISOString(),
  };
}

export async function saveReportTokens(tokens: ReportTokens): Promise<void> {
  await storeSetJson(TOKENS_KEY, tokens);
}
