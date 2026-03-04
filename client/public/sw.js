// Manus Brain — Service Worker v1.0
// Obsługuje Web Push powiadomienia

const CACHE_NAME = "manus-brain-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Obsługa przychodzących push powiadomień
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Manus Brain", body: event.data.text(), url: "/" };
  }

  const title = data.title || "Manus Brain";
  const options = {
    body: data.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.type || "general",
    renotify: true,
    requireInteraction: data.priority === "critical" || data.priority === "high",
    data: {
      url: data.url || "/",
      type: data.type,
      timestamp: data.timestamp || Date.now(),
    },
    actions: data.url
      ? [
          { action: "open", title: "Otwórz" },
          { action: "dismiss", title: "Zamknij" },
        ]
      : [],
    // Vibration pattern based on priority
    vibrate:
      data.priority === "critical"
        ? [200, 100, 200, 100, 200]
        : data.priority === "high"
        ? [200, 100, 200]
        : [100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Obsługa kliknięcia w powiadomienie
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Jeśli okno już otwarte — focus
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Otwórz nowe okno
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Obsługa zamknięcia powiadomienia
self.addEventListener("notificationclose", (event) => {
  // Można tu logować analytics
});
