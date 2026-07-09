// Modelo de dados minimalista (Seção 3 do SDD).

export type CaStatus = "OPEN" | "CLOSED";

export interface CaState {
  current_status: CaStatus;
  updated_at: string; // ISO 8601
}

export interface ReportEntry {
  id: string;
  action: CaStatus;
  timestamp: string; // ISO 8601
  reporter_hash: string; // SHA-256(IP + salt do dia) — nunca reversível
}
