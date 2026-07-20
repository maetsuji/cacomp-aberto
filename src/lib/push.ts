import { createHash } from "crypto";
import webpush, { type PushSubscription } from "web-push";
import { storeAvailable, storeGetJson, storeSetJson } from "./store";

/* ── Web Push: "avise-me quando o CA abrir" ──
 *
 * Assinaturas ficam num único JSON no Redis (ca:push:subs), indexadas
 * por hash do endpoint — escala esperada de dezenas/centenas de subs,
 * read-modify-write simples basta. O envio acontece no despachante de
 * transições (on-transition.ts) dentro de after(), fora do caminho
 * crítico do reporte. Subs mortas (404/410 do push service) são podadas
 * no próprio envio.
 *
 * Sem as chaves VAPID configuradas (ou sem Redis), tudo vira no-op —
 * mesmo padrão fail-open do resto do app. */

const SUBS_KEY = "ca:push:subs";

type SubsMap = Record<string, PushSubscription>;

export function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

function configureVapid(): void {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:cacomp@cacomp.xyz",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

const endpointHash = (endpoint: string) =>
  createHash("sha256").update(endpoint).digest("hex").slice(0, 16);

export async function addPushSubscription(
  subscription: PushSubscription
): Promise<void> {
  if (!storeAvailable()) return;
  const subs = (await storeGetJson<SubsMap>(SUBS_KEY)) ?? {};
  subs[endpointHash(subscription.endpoint)] = subscription;
  await storeSetJson(SUBS_KEY, subs);
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  if (!storeAvailable()) return;
  const subs = (await storeGetJson<SubsMap>(SUBS_KEY)) ?? {};
  delete subs[endpointHash(endpoint)];
  await storeSetJson(SUBS_KEY, subs);
}

/** Notifica todos os assinantes que o CA abriu; poda subs mortas. */
export async function sendOpenPush(at: Date): Promise<void> {
  if (!pushConfigured() || !storeAvailable()) return;

  const subs = (await storeGetJson<SubsMap>(SUBS_KEY)) ?? {};
  const entries = Object.entries(subs);
  if (entries.length === 0) return;

  configureVapid();

  const clock = at.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  const payload = JSON.stringify({
    title: "🟢 O CACOMP abriu!",
    body: `Aberto desde as ${clock} — passa lá!`,
    url: "/",
  });

  const dead: string[] = [];
  await Promise.allSettled(
    entries.map(async ([hash, subscription]) => {
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) dead.push(hash);
      }
    })
  );

  if (dead.length > 0) {
    for (const hash of dead) delete subs[hash];
    await storeSetJson(SUBS_KEY, subs);
  }
}
