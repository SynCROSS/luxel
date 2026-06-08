import { isCacheFresh, type HtmlCacheAdapter, type HtmlCacheEntry } from "./html-cache.ts";

/** In-process L1 over a durable adapter — ISR hits avoid repeated backing reads. */
export class TieredHtmlCacheAdapter implements HtmlCacheAdapter {
  private readonly memory = new Map<string, HtmlCacheEntry>();

  constructor(private readonly backing: HtmlCacheAdapter) {}

  async get(path: string): Promise<HtmlCacheEntry | null> {
    const mem = this.memory.get(path);
    if (mem) {
      if (isCacheFresh(mem)) return mem;
      this.memory.delete(path);
    }
    const entry = await this.backing.get(path);
    if (!entry || !isCacheFresh(entry)) return null;
    this.memory.set(path, entry);
    return entry;
  }

  async set(path: string, entry: HtmlCacheEntry): Promise<void> {
    this.memory.set(path, entry);
    await this.backing.set(path, entry);
  }

  async invalidateByTag(tag: string): Promise<void> {
    for (const [path, entry] of this.memory) {
      if (entry.tags.includes(tag)) this.memory.delete(path);
    }
    await this.backing.invalidateByTag(tag);
  }
}
