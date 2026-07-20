// Service worker mínimo: só Web Push. Sem cache offline de propósito —
// a Home é ISR na CDN e um cache no SW poderia servir status velho.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // payload não-JSON: usa os defaults abaixo
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? "CA Aberto?", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? "/"));
});
