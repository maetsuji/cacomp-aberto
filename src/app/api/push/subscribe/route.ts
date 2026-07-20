import type { PushSubscription } from "web-push";
import {
  addPushSubscription,
  pushConfigured,
  removePushSubscription,
} from "@/lib/push";

// Registro/remoção de assinaturas de Web Push (botão 🔔 da Home).
export const dynamic = "force-dynamic";

function isValidSubscription(body: unknown): body is PushSubscription {
  const sub = body as PushSubscription;
  return (
    typeof sub?.endpoint === "string" &&
    sub.endpoint.startsWith("https://") &&
    typeof sub?.keys?.p256dh === "string" &&
    typeof sub?.keys?.auth === "string"
  );
}

export async function POST(request: Request) {
  if (!pushConfigured()) {
    return Response.json({ ok: false }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!isValidSubscription(body)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  await addPushSubscription(body);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const endpoint = (body as { endpoint?: unknown })?.endpoint;
  if (typeof endpoint !== "string") {
    return Response.json({ ok: false }, { status: 400 });
  }

  await removePushSubscription(endpoint);
  return Response.json({ ok: true });
}
