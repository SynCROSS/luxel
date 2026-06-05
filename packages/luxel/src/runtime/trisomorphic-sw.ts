export type OfflineMode = "none" | "static" | "stale" | "custom";

export function generateTrisomorphicSw(policies: Record<string, OfflineMode>): string {
  return `
const CACHE_NAME = "luxel-html-v1";
const OFFLINE = ${JSON.stringify(policies)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        Object.entries(OFFLINE)
          .filter(([, mode]) => mode === "static" || mode === "stale")
          .map(async ([path]) => {
            const res = await fetch(path, { headers: { accept: "text/html" } });
            if (res.ok) await cache.put(path, res);
          }),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const policy = OFFLINE[url.pathname];
  if (!policy) return;
  if (policy === "none") {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(url.pathname).then((cached) => {
      if (cached && policy === "static") return cached;
      if (cached && policy === "stale") return cached;
      return fetch(event.request);
    }),
  );
});
`.trim();
}

/** @deprecated Use generateTrisomorphicSw with route policies. */
export const LUXEL_TRISOMORPHIC_SW = generateTrisomorphicSw({
  "/": "stale",
  "/detail": "none",
});
