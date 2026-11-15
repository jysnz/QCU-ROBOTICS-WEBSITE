/* Shows push notifications for the QCU Robotics admin area (Firebase Cloud Messaging, data-only messages).
   Registered from /admin with scope "/admin". Plain Web Push: no Firebase library is needed in here. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* not JSON */ }
  const d = payload.data || payload.notification || payload; // FCM puts our fields under "data"
  const title = d.title || "QCU Robotics";
  event.waitUntil((async () => {
    // when the admin page is open and in front, the bell already shows it live: no second pop-up
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (open.some((c) => c.visibilityState === "visible" && c.focused)) return;
    await self.registration.showNotification(title, {
      body: d.body || "",
      icon: "/logo-96.png",
      badge: "/logo-96.png",
      tag: d.type ? `${d.type}:${title}` : undefined,
      data: { link: d.link || "/admin" },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/admin";
  const url = new URL(link, self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const mine = wins.find((c) => new URL(c.url).pathname.startsWith("/admin"));
    if (mine) {
      await mine.focus();
      if ("navigate" in mine) { try { await mine.navigate(url); } catch { /* cross-origin guard */ } }
      return;
    }
    await self.clients.openWindow(url);
  })());
});
