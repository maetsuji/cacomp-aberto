"use client";

import { useEffect, useState } from "react";

// Botão discreto "avise-me quando abrir" (Web Push). Renderiza nada
// quando o browser não suporta push ou as chaves VAPID não estão
// configuradas — a Home fica idêntica à de antes.

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type PushState = "unsupported" | "idle" | "busy" | "subscribed";

export function PushSubscribeButton() {
  const [state, setState] = useState<PushState>("unsupported");

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (
      !vapidKey ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      return; // segue "unsupported": não renderiza nada
    }

    let cancelled = false;
    (async () => {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription();
      if (!cancelled) setState(subscription ? "subscribed" : "idle");
    })().catch(() => {
      /* SW indisponível (ex.: contexto inseguro): permanece oculto */
    });

    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  if (state === "unsupported") return null;

  const subscribe = async () => {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("idle");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey!),
      });
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      setState(response.ok ? "subscribed" : "idle");
    } catch {
      setState("idle");
    }
  };

  const unsubscribe = async () => {
    setState("busy");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
    } finally {
      setState("idle");
    }
  };

  const subscribed = state === "subscribed";
  return (
    <button
      type="button"
      onClick={subscribed ? unsubscribe : subscribe}
      disabled={state === "busy"}
      className="text-xs opacity-50 underline underline-offset-2 hover:opacity-80 disabled:opacity-30"
    >
      {subscribed
        ? "🔕 Parar de avisar quando abrir"
        : "🔔 Avise-me quando abrir"}
    </button>
  );
}
