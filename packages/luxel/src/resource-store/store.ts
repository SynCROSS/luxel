import type {
  ResourceCacheMeta,
  ResourceEntry,
  ResourceSetOptions,
  ResourceSnapshot,
} from "./types.ts";

export type {
  ResourceCacheMeta,
  ResourceEntry,
  ResourceSetOptions,
  ResourceSnapshot,
} from "./types.ts";

export class ResourceStore {
  #entries = new Map<string, ResourceEntry>();

  set(key: string, value: unknown, options: ResourceSetOptions = {}): void {
    const stableKey = options.key ?? key;
    const existing = this.#entries.get(stableKey);
    const generation = existing?.generation ?? 0;
    this.#entries.set(stableKey, {
      key: stableKey,
      value,
      tags: options.tags ?? [],
      cache: options.cache ?? {},
      generation,
      stale: false,
    });
  }

  get(key: string): unknown {
    return this.#entries.get(key)?.value;
  }

  getEntry(key: string): ResourceEntry | undefined {
    const entry = this.#entries.get(key);
    return entry ? { ...entry } : undefined;
  }

  getGeneration(key: string): number {
    return this.#entries.get(key)?.generation ?? 0;
  }

  isStale(key: string): boolean {
    const entry = this.#entries.get(key);
    return !entry || entry.stale;
  }

  revalidateTag(tag: string): void {
    for (const entry of this.#entries.values()) {
      if (entry.tags.includes(tag)) {
        entry.generation += 1;
        entry.stale = true;
      }
    }
  }

  mergeSnapshot(snapshot: ResourceSnapshot): void {
    for (const [key, incoming] of Object.entries(snapshot)) {
      const local = this.#entries.get(key);
      if (local && incoming.generation < local.generation) continue;
      this.#entries.set(key, {
        key,
        value: incoming.value,
        tags: [...incoming.tags],
        cache: { ...incoming.cache },
        generation: incoming.generation,
        stale: incoming.stale,
      });
    }
  }

  snapshot(): ResourceSnapshot {
    const out: ResourceSnapshot = {};
    for (const entry of this.#entries.values()) {
      out[entry.key] = {
        value: entry.value,
        generation: entry.generation,
        tags: [...entry.tags],
        cache: { ...entry.cache },
        stale: entry.stale,
      };
    }
    return out;
  }
}
