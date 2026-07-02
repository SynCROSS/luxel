export type StringCacheLimits = {
  globalMaxBytes: number;
  perRouteMaxBytes: number;
};

export const DEFAULT_STRING_CACHE_LIMITS: StringCacheLimits = {
  globalMaxBytes: 4 * 1024 * 1024,
  perRouteMaxBytes: 512 * 1024,
};

export type StringCacheMetrics = {
  hitBytes: number;
  missBytes: number;
  evictedBytes: number;
};

type CacheEntry = {
  bytes: Uint8Array;
  generation: number;
  refs: number;
  bytesLen: number;
};

export type StreamingStringCache = {
  intern(
    routeId: string,
    fieldPath: string,
    generation: number,
    text: string,
  ): { bytes: Uint8Array; hit: boolean };
  acquire(bytes: Uint8Array): void;
  release(bytes: Uint8Array): void;
  metrics(): StringCacheMetrics & { hitRatioBytes: number };
  clearRoute(routeId: string): void;
};

function cacheKey(routeId: string, fieldPath: string, text: string): string {
  return `${routeId}\0${fieldPath}\0${text}`;
}

export function createStreamingStringCache(limits: StringCacheLimits = DEFAULT_STRING_CACHE_LIMITS): StreamingStringCache {
  const entries = new Map<string, CacheEntry>();
  const routeBytes = new Map<string, number>();
  let globalBytes = 0;
  let hitBytes = 0;
  let missBytes = 0;
  let evictedBytes = 0;

  function evictEntry(key: string): void {
    const entry = entries.get(key);
    if (!entry || entry.refs > 0) return;
    entries.delete(key);
    globalBytes -= entry.bytesLen;
    const routeId = key.slice(0, key.indexOf("\0"));
    routeBytes.set(routeId, (routeBytes.get(routeId) ?? 0) - entry.bytesLen);
    evictedBytes += entry.bytesLen;
  }

  function ensureCapacity(routeId: string, needed: number): void {
    if (needed > limits.globalMaxBytes) {
      throw new Error("string cache: global byte cap exceeded");
    }
    if (needed > limits.perRouteMaxBytes) {
      throw new Error("string cache: per-route byte cap exceeded");
    }
    let safety = entries.size + 1;
    while (globalBytes + needed > limits.globalMaxBytes && safety-- > 0) {
      let evicted = false;
      for (const key of [...entries.keys()]) {
        evictEntry(key);
        evicted = true;
        if (globalBytes + needed <= limits.globalMaxBytes) break;
      }
      if (!evicted) break;
    }
    const routeUsed = routeBytes.get(routeId) ?? 0;
    if (routeUsed + needed > limits.perRouteMaxBytes) {
      for (const key of [...entries.keys()]) {
        if (!key.startsWith(`${routeId}\0`)) continue;
        evictEntry(key);
        if ((routeBytes.get(routeId) ?? 0) + needed <= limits.perRouteMaxBytes) break;
      }
    }
    if (globalBytes + needed > limits.globalMaxBytes) {
      throw new Error("string cache: global byte cap exceeded");
    }
    if ((routeBytes.get(routeId) ?? 0) + needed > limits.perRouteMaxBytes) {
      throw new Error("string cache: per-route byte cap exceeded");
    }
  }

  return {
    intern(routeId, fieldPath, generation, text) {
      const key = cacheKey(routeId, fieldPath, text);
      const existing = entries.get(key);
      if (existing && existing.generation === generation) {
        hitBytes += existing.bytesLen;
        return { bytes: existing.bytes, hit: true };
      }
      const bytes = new TextEncoder().encode(text);
      const needed = bytes.byteLength;
      if (existing) {
        if (existing.refs > 0) {
          missBytes += needed;
          return { bytes: bytes.slice(), hit: false };
        }
        globalBytes -= existing.bytesLen;
        routeBytes.set(routeId, (routeBytes.get(routeId) ?? 0) - existing.bytesLen);
        entries.delete(key);
      }
      ensureCapacity(routeId, needed);
      const stored = bytes.slice();
      entries.set(key, { bytes: stored, generation, refs: 0, bytesLen: needed });
      globalBytes += needed;
      routeBytes.set(routeId, (routeBytes.get(routeId) ?? 0) + needed);
      missBytes += needed;
      return { bytes: stored, hit: false };
    },
    acquire(bytes) {
      for (const entry of entries.values()) {
        if (entry.bytes === bytes) {
          entry.refs += 1;
          return;
        }
      }
    },
    release(bytes) {
      for (const entry of entries.values()) {
        if (entry.bytes === bytes) {
          entry.refs = Math.max(0, entry.refs - 1);
          return;
        }
      }
    },
    metrics() {
      const total = hitBytes + missBytes;
      return {
        hitBytes,
        missBytes,
        evictedBytes,
        hitRatioBytes: total === 0 ? 0 : hitBytes / total,
      };
    },
    clearRoute(routeId) {
      for (const key of [...entries.keys()]) {
        if (!key.startsWith(`${routeId}\0`)) continue;
        evictEntry(key);
      }
    },
  };
}

export function streamCachedJsonStringChunks(
  json: string,
  cache: StreamingStringCache,
  routeId: string,
  chunkSize: number,
): { chunks: Uint8Array[]; metrics: StringCacheMetrics & { hitRatioBytes: number } } {
  const stableKeys = ["version", "resources", "generation", "tags", "cache", "stale", "value"];
  for (const key of stableKeys) {
    cache.intern(routeId, `json:key:${key}`, 1, `"${key}"`);
  }
  const interned = cache.intern(routeId, "json:payload", 1, json);
  cache.acquire(interned.bytes);
  const source = interned.bytes;
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < source.byteLength; offset += chunkSize) {
    chunks.push(source.slice(offset, offset + chunkSize));
  }
  cache.release(interned.bytes);
  return { chunks, metrics: cache.metrics() };
}
