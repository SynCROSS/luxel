import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ensureCoreNodeBuilt } from "./helpers/ensure-core-node.ts";
import { getLuxelCoreNodeModule } from "../src/bench/ensure-core-node.ts";
import { compileRoute } from "../src/compiler/compile-route.ts";
import { createLoadContext } from "../src/resource-store/load-context.ts";
import { ResourceStore } from "../src/resource-store/store.ts";
import { getLuxelRepoRoot } from "../src/paths.ts";
import { shouldFailFastOnNativeSsrError } from "../src/config/native-mode.ts";

const repoRoot = getLuxelRepoRoot();
const baseGenRoot = join(repoRoot, "packages/luxel/src/.generated");
const counterRoute = join(repoRoot, "examples/counter/src/routes/index.luxel");

describe("shouldFailFastOnNativeSsrError", () => {
  test("strict mode fails fast", () => {
    expect(shouldFailFastOnNativeSsrError("strict")).toBe(true);
  });

  test("auto mode allows TS fallback unless bench override", () => {
    const prev = process.env.LUXEL_BENCH_STRICT_NATIVE;
    delete process.env.LUXEL_BENCH_STRICT_NATIVE;
    try {
      expect(shouldFailFastOnNativeSsrError("auto")).toBe(false);
      expect(shouldFailFastOnNativeSsrError("off")).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.LUXEL_BENCH_STRICT_NATIVE;
      else process.env.LUXEL_BENCH_STRICT_NATIVE = prev;
    }
  });
});

describe("native SSR strict fail-fast", () => {
  beforeAll(() => ensureCoreNodeBuilt(), 300_000);

  test("native.mode strict throws when route-specific kernel fails", async () => {
    const mod = getLuxelCoreNodeModule();
    if (!mod) throw new Error("core-node missing");
    const original = mod.renderCounterBody;
    mod.renderCounterBody = () => {
      throw new Error("native kernel blocked");
    };
    try {
      const route = await compileRoute(counterRoute, {
        routeId: "route:index",
        path: "/",
        source: "examples/counter/src/routes/index.luxel",
        componentId: "sfc:counter",
        slug: "index",
        genRoot: join(baseGenRoot, "native-strict-failfast-counter"),
        ssrBackend: "native",
        nativeMode: "strict",
        disableStaticPrecompute: true,
      });
      const store = new ResourceStore();
      await route.load(createLoadContext(store));
      expect(() => route.renderFromStore(store)).toThrow(/strict mode: native SSR failed/i);
    } finally {
      mod.renderCounterBody = original;
    }
  }, 180_000);

  test("native.mode auto falls back to TS when route-specific kernel fails", async () => {
    const mod = getLuxelCoreNodeModule();
    if (!mod) throw new Error("core-node missing");
    const prevBenchStrict = process.env.LUXEL_BENCH_STRICT_NATIVE;
    delete process.env.LUXEL_BENCH_STRICT_NATIVE;
    const original = mod.renderCounterBody;
    mod.renderCounterBody = () => {
      throw new Error("native kernel blocked");
    };
    try {
      const route = await compileRoute(counterRoute, {
        routeId: "route:index",
        path: "/",
        source: "examples/counter/src/routes/index.luxel",
        componentId: "sfc:counter",
        slug: "index",
        genRoot: join(baseGenRoot, "native-auto-fallback-counter"),
        ssrBackend: "native",
        nativeMode: "auto",
        disableStaticPrecompute: true,
      });
      const store = new ResourceStore();
      await route.load(createLoadContext(store));
      const html = route.renderFromStore(store);
      expect(html).toContain("<h1>Hello Luxel</h1>");
      expect(html).toContain('data-luxel-text="count"');
    } finally {
      mod.renderCounterBody = original;
      if (prevBenchStrict === undefined) delete process.env.LUXEL_BENCH_STRICT_NATIVE;
      else process.env.LUXEL_BENCH_STRICT_NATIVE = prevBenchStrict;
    }
  }, 180_000);

  test("strict native compile fails during static precompute when kernel fails", async () => {
    const mod = getLuxelCoreNodeModule();
    if (!mod) throw new Error("core-node missing");
    const original = mod.renderCounterBody;
    mod.renderCounterBody = () => {
      throw new Error("native kernel blocked");
    };
    try {
      await expect(
        compileRoute(counterRoute, {
          routeId: "route:index",
          path: "/",
          source: "examples/counter/src/routes/index.luxel",
          componentId: "sfc:counter",
          slug: "index",
          genRoot: join(baseGenRoot, "native-strict-precompute-counter"),
          ssrBackend: "native",
          nativeMode: "strict",
        }),
      ).rejects.toThrow(/strict mode: native SSR failed/i);
    } finally {
      mod.renderCounterBody = original;
    }
  }, 180_000);
});
