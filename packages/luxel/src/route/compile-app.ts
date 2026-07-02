import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { compileRoute, type CompiledRoute } from "../compiler/compile-route.ts";
import { discoverRouteFiles } from "../routing/discover-routes.ts";
import type { Manifest } from "../manifest/types.ts";
import { getLuxelPkgSrc } from "../paths.ts";
import type { BundleBackend } from "../host/backends/types.ts";
import { pickBundleBackend } from "../build/pick-bundle-backend.ts";
import { loadLuxelConfig } from "../config/load.ts";
import { resolveNativeSchemasConfig } from "../config/native-schemas.ts";
import {
  assertNativeModeForAppRoot,
  routeSsrBackendForNativeMode,
  toManifestNativeDiagnostics,
} from "../config/native-mode.ts";
import { detectClientGpuCapabilities } from "../client-gpu/capabilities.ts";
import { resolveNativeGpuClient, toManifestGpuDiagnostics } from "../config/native-gpu.ts";
import type { NativeRuntimeKind } from "../config/native-runtime.ts";

export type CompileAppOptions = {
  bundleBackend?: BundleBackend;
  /** Per-route SSR backend overrides (luxel.config `routes[path].ssr` wins when set). */
  routeSsrBackends?: Record<string, "ts" | "native">;
  /** Separate generated output dir for bench pool artifacts (avoids clobbering dev compile cache). */
  genRootSuffix?: string;
  /** Skip compile-time static-load precompute (true per-request SSR for bench parity rows). */
  benchFullRender?: boolean;
  /** Native lab WinRK row: per-request native without compile-time precompute. */
  benchNativeLab?: boolean;
  /** Override native.runtime resolution (tests/bench). */
  nativeRuntime?: NativeRuntimeKind | "auto";
};

export type CompiledApp = {
  appDir: string;
  genRoot: string;
  manifest: Manifest;
  routes: CompiledRoute[];
  getRoute: (path: string) => CompiledRoute | undefined;
  writeCache: () => Promise<string>;
  writeDist: (outDir: string) => Promise<void>;
};

export async function compileApp(
  repoRoot: string,
  appDir: string,
  options?: CompileAppOptions,
): Promise<CompiledApp> {
  const bundleBackend = options?.bundleBackend ?? pickBundleBackend();
  const slug = appDir.replace(/^examples\//, "");
  const appRoot = join(repoRoot, appDir);
  const luxelConfig = await loadLuxelConfig(appRoot);
  const nativeSchemas = resolveNativeSchemasConfig(luxelConfig.native);
  const nativeMode = await assertNativeModeForAppRoot(appRoot);
  const nativeRuntime: NativeRuntimeKind =
    options?.nativeRuntime && options.nativeRuntime !== "auto"
      ? options.nativeRuntime
      : nativeMode.nativeRuntime;
  const routesDir = join(appRoot, luxelConfig.routesDir);
  const genRoot = join(
    getLuxelPkgSrc(),
    ".generated",
    options?.genRootSuffix ? `${slug}-${options.genRootSuffix}` : slug,
  );
  const discovered = await discoverRouteFiles(routesDir);

  const routes: CompiledRoute[] = [];
  for (const route of discovered) {
    const source = `${appDir}/src/routes/${route.slug}.luxel`;
    routes.push(
      await compileRoute(route.filePath, {
        routeId: route.routeId,
        path: route.path,
        source,
        componentId: route.componentId,
        slug: route.slug,
        genRoot,
        bundleBackend,
        configClientHydration: luxelConfig.routes?.[route.path]?.client?.hydration,
        ssrBackend: routeSsrBackendForNativeMode(
          nativeMode,
          options?.routeSsrBackends?.[route.path] ?? luxelConfig.routes?.[route.path]?.ssr,
        ),
        routeThirdPartySchema: nativeSchemas.thirdPartyEnabled
          ? luxelConfig.routes?.[route.path]?.thirdPartySchema
          : undefined,
        nativeMode: nativeMode.configured,
        nativeRuntimePreference: luxelConfig.native?.runtime,
        nativeRuntime,
        disableStaticPrecompute:
          (options?.benchFullRender ?? false) || (options?.benchNativeLab ?? false),
      }),
    );
  }

  const manifest: Manifest = {
    version: 2,
    native: toManifestNativeDiagnostics(nativeMode),
    gpu: toManifestGpuDiagnostics(
      resolveNativeGpuClient(luxelConfig.native?.gpu, detectClientGpuCapabilities()),
    ),
    routes: routes.map((r) => r.manifestRoute),
    components: routes.map((r) => r.manifestComponent),
  };

  const app: CompiledApp = {
    appDir,
    genRoot,
    manifest,
    routes,
    getRoute: (path) => routes.find((r) => r.path === path),
    writeCache: async () => {
      for (const route of routes) {
        await route.writeCacheFiles();
      }
      await writeClientEntry(genRoot, routes);
      return genRoot;
    },
    writeDist: async (outDir) => {
      await mkdir(join(outDir, "server/routes"), { recursive: true });
      await mkdir(join(outDir, "client/routes"), { recursive: true });
      await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
      for (const route of routes) {
        await writeFile(join(outDir, "server/routes", `${route.slug}.ts`), route.serverModuleSrc, "utf8");
        await writeFile(join(outDir, "client/routes", `${route.slug}.ts`), route.clientModuleSrc, "utf8");
        if (route.attachModuleSrc) {
          await writeFile(
            join(outDir, "client/routes", `${route.slug}.attach.ts`),
            route.attachModuleSrc,
            "utf8",
          );
        }
      }
    },
  };

  await app.writeCache();
  return app;
}

export async function compileCounterApp(
  repoRoot: string,
  options?: CompileAppOptions,
): Promise<CompiledApp> {
  return compileApp(repoRoot, "examples/counter", options);
}

export async function compileNavDemoApp(
  repoRoot: string,
  options?: CompileAppOptions,
): Promise<CompiledApp> {
  return compileApp(repoRoot, "examples/nav-demo", options);
}

async function writeClientEntry(genRoot: string, routes: CompiledRoute[]): Promise<void> {
  const hydrated = routes.filter((r) => r.hasClientBundle);
  const shipsClient = routes.some((r) => r.shipClientRuntime);
  const imports = hydrated
    .map((r) => `import * as route_${r.slug} from "./client/routes/${r.slug}.ts";`)
    .join("\n");
  const map = hydrated.map((r) => `  "${r.routeId}": route_${r.slug}`).join(",\n");
  await writeFile(
    join(genRoot, "client-entry.ts"),
    [
      `import { hydrateFromDocument } from "../../runtime/hydrate.ts";`,
      `import { setupClientNav } from "../../runtime/client-nav.ts";`,
      imports,
      ``,
      `const modules = {`,
      map,
      `};`,
      `if (Object.keys(modules).length > 0) hydrateFromDocument(modules);`,
      shipsClient ? `setupClientNav(modules);` : ``,
    ].join("\n"),
    "utf8",
  );
}
