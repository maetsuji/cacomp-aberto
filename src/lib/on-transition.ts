import { after } from "next/server";
import { recordTransition } from "./intervals";
import { sendOpenPush } from "./push";
import type { CaStatus } from "./types";

/* ── Despachante de transições de status ──
 *
 * Chamado por setCaState (status.ts) APENAS quando o status muda de
 * fato (ABERTO↔FECHADO) — reportes repetidos do mesmo estado não passam
 * por aqui. Ponto único de fan-out de efeitos colaterais de transição.
 *
 * IMPORTANTE: setCaState também roda DURANTE render ISR (o auto-close
 * preguiçoso pega carona na regeneração da Home), então aqui só cabem
 * efeitos seguros em qualquer contexto (escritas Redis, `after()`).
 * `revalidatePath` é proibido em render — quem revalida é o chamador
 * em contexto de route handler (processReport). */

export async function onStatusTransition(
  status: CaStatus,
  at: Date
): Promise<void> {
  await recordTransition(status, at);

  // Web Push fora do caminho crítico: after() executa depois da
  // resposta/render terminar, então o reporte não espera os envios.
  if (status === "OPEN") {
    after(() => sendOpenPush(at));
  }

  // Futuro: webhook do bot WhatsApp (F1) pluga aqui — docs/ROADMAP.md.
}
