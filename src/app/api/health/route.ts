import { storeAvailable, storeGetJson } from "@/lib/store";

// Health check para monitor de uptime externo (UptimeRobot etc. — ver
// docs/DEV.md). Sempre dinâmico: cache aqui esconderia exatamente a
// queda que o monitor existe pra detectar.
export const dynamic = "force-dynamic";

const STORE_TIMEOUT_MS = 2000;

export async function GET() {
  // Sem store configurado (dev local): o site funciona em fail-open,
  // então o health reporta saudável — só sinaliza que não há Redis.
  if (!storeAvailable()) {
    return Response.json({ ok: true, store: "absent" });
  }

  try {
    await Promise.race([
      storeGetJson("ca:status"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("store timeout")), STORE_TIMEOUT_MS)
      ),
    ]);
    return Response.json({ ok: true, store: "ok" });
  } catch {
    return Response.json({ ok: false, store: "down" }, { status: 503 });
  }
}
