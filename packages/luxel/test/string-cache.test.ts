import { describe, expect, test } from "bun:test";
import { buildLargeLuxelDataFixture } from "../src/schema/bench.ts";
import {
  createStreamingStringCache,
  streamCachedJsonStringChunks,
} from "../src/schema/string-cache.ts";

describe("streaming string cache", () => {
  test("reuses cached chunks for repeated stable values", () => {
    const cache = createStreamingStringCache({ globalMaxBytes: 1024 * 1024, perRouteMaxBytes: 512 * 1024 });
    const json = JSON.stringify(buildLargeLuxelDataFixture(8));
    const first = streamCachedJsonStringChunks(json, cache, "route:spiral", 64);
    const second = streamCachedJsonStringChunks(json, cache, "route:spiral", 64);
    expect(first.chunks.length).toBeGreaterThan(0);
    expect(second.metrics.hitBytes).toBeGreaterThan(0);
    expect(second.metrics.hitRatioBytes).toBeGreaterThan(0);
  });

  test("invalidates cached chunks when generation changes", () => {
    const cache = createStreamingStringCache({ globalMaxBytes: 1024 * 1024, perRouteMaxBytes: 512 * 1024 });
    cache.intern("route:index", "message", 1, "hello");
    const hit = cache.intern("route:index", "message", 1, "hello");
    expect(hit.hit).toBe(true);
    const miss = cache.intern("route:index", "message", 2, "hello");
    expect(miss.hit).toBe(false);
  });

  test("enforces global byte cap deterministically", () => {
    const cache = createStreamingStringCache({ globalMaxBytes: 32, perRouteMaxBytes: 32 });
    expect(() => cache.intern("route:a", "field", 1, "x".repeat(40))).toThrow(/byte cap/i);
  });

  test("concurrent consumers can share immutable cached chunks via ref count", () => {
    const cache = createStreamingStringCache({ globalMaxBytes: 1024, perRouteMaxBytes: 1024 });
    const a = cache.intern("route:index", "message", 1, "shared-value");
    const b = cache.intern("route:index", "message", 1, "shared-value");
    expect(a.bytes).toBe(b.bytes);
    cache.acquire(a.bytes);
    cache.acquire(a.bytes);
    cache.release(a.bytes);
    cache.release(a.bytes);
    expect(cache.metrics().hitBytes).toBeGreaterThan(0);
  });
});

describe("schema stream bench cache metrics", () => {
  test("bench publishes cache hit ratio by bytes", async () => {
    const { runSchemaStreamStringCacheBench } = await import("../src/schema/bench.ts");
    const lines = [...runSchemaStreamStringCacheBench(64, 32)];
    expect(lines.some((line) => line.metric === "cache_hit_ratio_bytes")).toBe(true);
    const ratio = lines.find((line) => line.metric === "cache_hit_ratio_bytes")?.value ?? 0;
    expect(ratio).toBeGreaterThan(0);
  });
});
