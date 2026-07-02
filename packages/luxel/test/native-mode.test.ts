import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assertNativeModeStartup,
  assertNativeModeForAppRoot,
  resolveNativeMode,
  routeSsrBackendForNativeMode,
} from "../src/config/native-mode.ts";
import { assertNativeRuntimeStartup } from "../src/config/native-runtime.ts";
import { isLuxelCoreNodeLoadable } from "../src/bench/ensure-core-node.ts";
import { loadLuxelConfig } from "../src/config/load.ts";
import { compileApp } from "../src/route/compile-app.ts";
import { devApp } from "../src/dev/serve.ts";

const repoRoot = join(import.meta.dir, "../../..");

async function withForcedUnavailableNative<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.LUXEL_NATIVE_FORCE_UNAVAILABLE;
  process.env.LUXEL_NATIVE_FORCE_UNAVAILABLE = "1";
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.LUXEL_NATIVE_FORCE_UNAVAILABLE;
    else process.env.LUXEL_NATIVE_FORCE_UNAVAILABLE = prev;
  }
}

async function withForcedUnavailableRenderd<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.LUXEL_RENDERD_FORCE_UNAVAILABLE;
  process.env.LUXEL_RENDERD_FORCE_UNAVAILABLE = "1";
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.LUXEL_RENDERD_FORCE_UNAVAILABLE;
    else process.env.LUXEL_RENDERD_FORCE_UNAVAILABLE = prev;
  }
}

async function writeStrictProcessConfigApp(): Promise<string> {
  const rel = `packages/luxel/test/.tmp-native-strict-process-${Date.now()}`;
  const dir = join(repoRoot, rel);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "luxel.config.ts"),
    `export default {
  root: ".",
  routesDir: "src/routes",
  outDir: "dist",
  native: { mode: "strict", runtime: "process" },
};`,
    "utf8",
  );
  return rel;
}

async function writeStrictConfigApp(): Promise<string> {
  const rel = `packages/luxel/test/.tmp-native-strict-${Date.now()}`;
  const dir = join(repoRoot, rel);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "luxel.config.ts"),
    `export default {
  root: ".",
  routesDir: "src/routes",
  outDir: "dist",
  native: { mode: "strict" },
};`,
    "utf8",
  );
  return rel;
}

describe("resolveNativeMode", () => {
  test("off disables native regardless of addon availability", () => {
    const result = resolveNativeMode({ mode: "off" });
    expect(result.configured).toBe("off");
    expect(result.effective).toBe("off");
    expect(result.diagnostics).toContain("native.mode=off");
  });

  test("auto enables native when luxel-core addon is loadable", () => {
    const result = resolveNativeMode({ mode: "auto" });
    expect(result.configured).toBe("auto");
    if (result.coreNodeLoadable) {
      expect(result.effective).toBe("on");
      expect(result.diagnostics.some((d) => d.includes("luxel-core"))).toBe(true);
    } else {
      expect(result.effective).toBe("off");
      expect(result.diagnostics.some((d) => d.includes("fallback"))).toBe(true);
    }
  });

  test("strict throws when luxel-core addon is unavailable", () => {
    const result = resolveNativeMode({ mode: "strict" });
    expect(result.configured).toBe("strict");
    if (!result.coreNodeLoadable) {
      expect(() => assertNativeModeStartup(result)).toThrow(/strict/i);
    }
  });
});

describe("loadLuxelConfig native.mode", () => {
  test("loads native.mode from luxel.config.ts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "luxel-native-config-"));
    await writeFile(
      join(dir, "luxel.config.ts"),
      `export default { root: ".", routesDir: "src/routes", outDir: "dist", native: { mode: "off" } };`,
      "utf8",
    );
    const config = await loadLuxelConfig(dir);
    expect(config.native?.mode).toBe("off");
  });

  test("loads native.schemas.thirdParty from luxel.config.ts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "luxel-native-schemas-"));
    await writeFile(
      join(dir, "luxel.config.ts"),
      `export default { root: ".", routesDir: "src/routes", outDir: "dist", native: { schemas: { thirdParty: true } } };`,
      "utf8",
    );
    const config = await loadLuxelConfig(dir);
    expect(config.native?.schemas?.thirdParty).toBe(true);
  });
});

describe("compileApp native manifest diagnostics", () => {
  test("manifest records native mode diagnostics", async () => {
    const app = await compileApp(repoRoot, "examples/counter");
    expect(app.manifest.native).toBeDefined();
    expect(app.manifest.native?.mode).toBe("auto");
    expect(["on", "off"]).toContain(app.manifest.native?.effective);
    expect(app.manifest.native?.diagnostics.length).toBeGreaterThan(0);
  });

  test("native.mode off forces ts SSR even when route requests native", () => {
    const nativeMode = resolveNativeMode({ mode: "off" });
    expect(routeSsrBackendForNativeMode(nativeMode, "native")).toBe("ts");
    expect(routeSsrBackendForNativeMode(nativeMode, "auto")).toBe("ts");
  });
});

describe("native.mode strict startup", () => {
  test("compileApp fails before route compile when strict and addon unavailable", async () => {
    await withForcedUnavailableNative(async () => {
      const rel = await writeStrictConfigApp();
      await expect(compileApp(repoRoot, rel)).rejects.toThrow(/luxel-native strict mode/i);
      await rm(join(repoRoot, rel), { recursive: true, force: true });
    });
  });

  test("devApp surfaces luxel-native strict startup error", async () => {
    await withForcedUnavailableNative(async () => {
      const rel = await writeStrictConfigApp();
      await expect(devApp(repoRoot, rel, { port: 0 })).rejects.toThrow(/luxel-native strict mode/i);
      await rm(join(repoRoot, rel), { recursive: true, force: true });
    });
  });

  test("luxel dev CLI surfaces luxel-native strict startup error", async () => {
    await withForcedUnavailableNative(async () => {
      const rel = await writeStrictConfigApp();
      const appDir = join(repoRoot, rel);
      const proc = Bun.spawn(["bun", join(repoRoot, "packages/luxel/src/cli.ts"), "dev"], {
        cwd: appDir,
        stdout: "ignore",
        stderr: "pipe",
        env: { ...process.env, PORT: "0", LUXEL_NATIVE_FORCE_UNAVAILABLE: "1" },
      });
      const code = await Promise.race([
        proc.exited,
        Bun.sleep(8_000).then(async () => {
          proc.kill();
          return proc.exited;
        }),
      ]);
      const stderr = await new Response(proc.stderr).text();
      expect(code).not.toBe(0);
      expect(stderr).toContain("luxel-native strict mode");
      await rm(appDir, { recursive: true, force: true });
    });
  }, 15_000);
});

describe("native.runtime strict startup", () => {
  test("strict native.runtime process throws when renderd unavailable but core-node loadable", async () => {
    await withForcedUnavailableRenderd(async () => {
      if (!isLuxelCoreNodeLoadable()) return;
      const resolution = resolveNativeMode({ mode: "strict", runtime: "process" });
      expect(resolution.coreNodeLoadable).toBe(true);
      expect(resolution.nativeRuntime).toBe("process");
      expect(() => assertNativeRuntimeStartup(resolution, resolution.nativeRuntime)).toThrow(
        /luxel-renderd runtime/i,
      );
    });
  });

  test("compileApp fails when strict native.runtime process and renderd unavailable", async () => {
    await withForcedUnavailableRenderd(async () => {
      if (!isLuxelCoreNodeLoadable()) return;
      const rel = await writeStrictProcessConfigApp();
      const appRoot = join(repoRoot, rel);
      await expect(assertNativeModeForAppRoot(appRoot)).rejects.toThrow(/luxel-renderd runtime/i);
      await expect(compileApp(repoRoot, rel)).rejects.toThrow(/luxel-renderd runtime/i);
      await rm(appRoot, { recursive: true, force: true });
    });
  });
});
