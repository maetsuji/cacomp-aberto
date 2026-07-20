import type { BackgroundSettings } from "@/lib/background-settings";
import type { BlobColors } from "@/lib/blob-theme";

// Injeta as CSS vars do fundo no :root. O DOM do fundo (tijolo + véu +
// blobs) vive no layout raiz e PERSISTE entre navegações client-side —
// só as cores/opacidade mudam de página pra página, via este <style>
// server-rendered (zero JS, zero flash). Sem risco de injeção: as cores
// passam pelo regex HEX_COLOR (blob-theme) e a opacidade é número
// clampado (sanitização nos getters).

export function BackgroundStyle({
  blobs,
  background,
}: {
  blobs: BlobColors;
  background: BackgroundSettings;
}) {
  return (
    <style>{`:root{--blob-a:${blobs.blobA};--blob-b:${blobs.blobB};--bg-overlay-opacity:${background.overlayOpacity};--brick-display:${background.enabled ? "block" : "none"};}`}</style>
  );
}
