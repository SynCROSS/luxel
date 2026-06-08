export type HtmlCacheEntry = {
  html: string;
  /** Pre-encoded document bytes for cache-hit responses. */
  body?: Uint8Array;
  writtenAt: number;
  revalidateSeconds: number;
  tags: string[];
};

/** Pluggable ISR HTML cache (filesystem default; Redis etc. later). */
export interface HtmlCacheAdapter {
  get(path: string): Promise<HtmlCacheEntry | null>;
  set(path: string, entry: HtmlCacheEntry): Promise<void>;
  invalidateByTag(tag: string): Promise<void>;
}

export function isCacheFresh(entry: HtmlCacheEntry, now = Date.now()): boolean {
  return now - entry.writtenAt < entry.revalidateSeconds * 1000;
}
