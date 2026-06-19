const CONNECT_ERROR_RE =
  /unable to connect|econnrefused|econnreset|socket hang up|socket connection was closed unexpectedly|socket was closed/i;

export function isBenchConnectError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return CONNECT_ERROR_RE.test(err.message);
}

export type BenchFetchRetryOptions = {
  attempts?: number;
  delayMs?: number;
  backoff?: number;
};

const DEFAULT_ATTEMPTS = Number(process.env.BENCH_FETCH_RETRY_ATTEMPTS ?? "12");
const DEFAULT_DELAY_MS = Number(process.env.BENCH_FETCH_RETRY_DELAY_MS ?? "250");

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Bench fetch — Connection: close + retry on transient localhost connect failures (Windows port pressure). */
export async function benchFetch(
  url: string,
  init: RequestInit = {},
  retry: BenchFetchRetryOptions = {},
): Promise<Response> {
  const attempts = retry.attempts ?? DEFAULT_ATTEMPTS;
  let delay = retry.delayMs ?? DEFAULT_DELAY_MS;
  const backoff = retry.backoff ?? 1.5;
  const headers = new Headers(init.headers);
  if (!headers.has("connection")) headers.set("connection", "close");

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, { ...init, headers });
    } catch (err) {
      lastErr = err;
      if (!isBenchConnectError(err) || i === attempts - 1) throw err;
      await sleep(delay);
      delay = Math.min(delay * backoff, 5000);
    }
  }
  throw lastErr;
}

/** Probe until server accepts connections — avoids flaky first fetch after heavy winrk windows. */
export async function waitForServerReady(url: string): Promise<void> {
  const target = url.endsWith("/") ? url : `${url}/`;
  const res = await benchFetch(target);
  if (!res.ok) throw new Error(`server not ready: ${res.status} ${target}`);
  await res.text();
}
