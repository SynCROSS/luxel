import { benchFetch } from "@luxel/luxel/bench";

/** Probe response body size — "loaded resources" column (HTML transfer weight). */
export async function probeResponseBytes(url: string): Promise<number> {
  const res = await benchFetch(url);
  if (!res.ok) throw new Error(`probe failed: ${res.status}`);
  const body = await res.text();
  return new TextEncoder().encode(body).byteLength;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
