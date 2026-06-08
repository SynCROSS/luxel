const cache = new Map<string, { body: string; at: number }>();
export async function handle({ event, resolve }) {
  const key = event.url.pathname;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < 1000) {
    return new Response(hit.body, { headers: { "content-type": "text/html; charset=utf-8", "x-cache": "hit" } });
  }
  const response = await resolve(event);
  const body = await response.text();
  cache.set(key, { body, at: now });
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "x-cache": "miss" } });
}