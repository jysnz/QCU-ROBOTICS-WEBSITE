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
    // Similar notifications share one slot on the device (tag = type) and collapse into a single summary,
    // e.g. "3 new tasks", instead of a stack of separate pop-ups.
    const tag = d.type || "general";
    const prev = (await self.registration.getNotifications({ tag })).reduce((n, x) => Math.max(n, (x.data && x.data.count) || 1), 0);
    const count = prev + 1;
    const WORDS = { task_assigned: "new tasks", task_done: "tasks finished", task_due: "tasks due soon", task_late: "overdue tasks", registration: "registrations to review", birthday: "birthdays" };
    await self.registration.showNotification(count > 1 ? `${count} ${WORDS[d.type] || "new notifications"}` : title, {
      body: count > 1 ? `Latest: ${d.body ? `${title}. ${d.body}` : title}` : d.body || "",
      icon: "/logo-96.png",
      badge: "/logo-96.png",
      tag,
      renotify: false, // a newer one updates the summary quietly rather than buzzing the phone again
      data: { link: d.link || "/admin", count },
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
