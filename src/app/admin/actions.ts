"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isGeofenceEnabled, setGeofenceEnabled } from "@/lib/geofence";
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
