import { storeAvailable, storeGetJson, storeSetJson } from "./store";
import type { CaStatus } from "./types";

/* ── Cores customizáveis dos blobs (fundo vivo da Home) ──
 *
 * A tab /admin/blobs permite trocar as duas cores de blob de cada estado
 * sem redeploy. O valor vive no Redis e é lido pela Home a cada
 * regeneração ISR — salvar no admin chama revalidatePath("/"), então a
 * mudança vale para todo visitante imediatamente, mantendo o custo de
 * página estática (mesmo mecanismo dos reportes, ver page.tsx).
 *
 * Sem nada salvo (ou sem Redis, em dev local), valem os defaults abaixo
 * — as cores originais do design. */

export interface BlobColors {
  blobA: string; // mancha principal (radial-gradient dos blobs 1 e 3)
  blobB: string; // mancha secundária (blob 2)
}

export type BlobTheme = Record<CaStatus, BlobColors>;

export const DEFAULT_BLOB_THEME: BlobTheme = {
  OPEN: { blobA: "#22c55e", blobB: "#2dd472" },
  CLOSED: { blobA: "#f62e2e", blobB: "#ef333f" },
};

const BLOB_THEME_KEY = "ca:blob-theme";

/** As cores viram CSS vars inline na Home — só hex estrito passa. */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function sanitizeColors(
  stored: Partial<BlobColors> | undefined,
  fallback: BlobColors
): BlobColors {
  return {
    blobA:
      stored?.blobA && HEX_COLOR.test(stored.blobA)
        ? stored.blobA
        : fallback.blobA,
    blobB:
      stored?.blobB && HEX_COLOR.test(stored.blobB)
        ? stored.blobB
        : fallback.blobB,
  };
}

/** Tema vigente: o salvo no Redis (campo a campo, validado) ou o default. */
export async function getBlobTheme(): Promise<BlobTheme> {
  if (!storeAvailable()) return DEFAULT_BLOB_THEME;
  const stored = await storeGetJson<Partial<BlobTheme>>(BLOB_THEME_KEY);
  if (!stored) return DEFAULT_BLOB_THEME;
  return {
    OPEN: sanitizeColors(stored.OPEN, DEFAULT_BLOB_THEME.OPEN),
    CLOSED: sanitizeColors(stored.CLOSED, DEFAULT_BLOB_THEME.CLOSED),
  };
}

export async function setBlobTheme(theme: BlobTheme): Promise<void> {
  await storeSetJson(BLOB_THEME_KEY, theme);
}

/** Volta ao default gravando null — getBlobTheme trata como "nada salvo". */
export async function resetBlobTheme(): Promise<void> {
  await storeSetJson(BLOB_THEME_KEY, null);
}
