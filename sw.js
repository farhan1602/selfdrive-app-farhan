// Minimal service worker so the app can be installed on a phone's home screen.
// It does not cache anything: the app always loads fresh data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
