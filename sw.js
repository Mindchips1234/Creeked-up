// Service worker: keeps the app working with no signal.
// Bump CACHE when any app file changes so phones pick up the new version.
const CACHE = "creeked-up-v10";
const FILES = [
  "./",
  "index.html",
  "css/styles.css",
  "js/data.js",
  "js/game.js",
  "js/exif.js",
  "js/db.js",
  "js/spots.js",
  "js/seasons.js",
  "js/quests.js",
  "js/idguide.js",
  "js/conditions.js",
  "js/methods.js",
  "js/tackle.js",
  "js/share.js",
  "js/config.js",
  "js/cloud.js",
  "js/app.js",
  "js/account.js",
  "js/mapview.js",
  "vendor/leaflet/leaflet.js",
  "vendor/leaflet/leaflet.css",
  "vendor/supabase/supabase.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, so updates show up when online; fall back to the cache offline.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
