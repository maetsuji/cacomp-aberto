import type { CaState, CaStatus, ReportEntry } from "./types";
import {
  storeAvailable,
  storeGetJson,
  storeLpushJson,
  storeLrangeJson,
  storeLtrim,
  storeSetJson,
} from "./store";

// Chaves no Vercel KV (Redis). Estrutura chave-valor pura:
// - ca:status          -> objeto CaState (estado atual)
// - ca:history         -> lista (LPUSH) com os últimos reportes
const STATUS_KEY = "ca:status";
const HISTORY_KEY = "ca:history";
const HISTORY_MAX = 20; // guardamos 20, exibimos 5 na Home

const FALLBACK_STATE: CaState = {
  current_status: "CLOSED",
  updated_at: new Date(0).toISOString(),
};

// Sem Redis configurado (dev local ou build de CI), o app degrada para o
// estado padrão em vez de quebrar.
const kvAvailable = () => storeAvailable();

/** Lê o estado atual do CA. Se o KV estiver vazio (primeiro deploy), assume FECHADO. */
export async function getCaState(): Promise<CaState> {
  if (!kvAvailable()) return FALLBACK_STATE;
  const state = await storeGetJson<CaState>(STATUS_KEY);
  return state ?? FALLBACK_STATE;
}

/** Últimos N reportes para o feed de transparência da Home. */
export async function getRecentReports(limit = 5): Promise<ReportEntry[]> {
  if (!kvAvailable()) return [];
  const entries = await storeLrangeJson<ReportEntry>(HISTORY_KEY, 0, limit - 1);
  return entries ?? [];
}

/** Persiste um novo estado + registra o log anônimo no histórico. */
export async function setCaState(
  action: CaStatus,
  reporterHash: string
): Promise<CaState> {
  const now = new Date().toISOString();

  const state: CaState = { current_status: action, updated_at: now };
  const entry: ReportEntry = {
    id: crypto.randomUUID(),
    action,
    timestamp: now,
    reporter_hash: reporterHash,
  };

  await Promise.all([
    storeSetJson(STATUS_KEY, state),
    storeLpushJson(HISTORY_KEY, entry),
  ]);
  await storeLtrim(HISTORY_KEY, 0, HISTORY_MAX - 1);

  return state;
}
