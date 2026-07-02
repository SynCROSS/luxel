import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { streamHtmlDocument } from "../compiler/stream-document.ts";
import type { Manifest } from "../manifest/types.ts";
import type { AppRoute, AppRuntime } from "../server/app-runtime.ts";
import type { LuxelDataV2 } from "../resource-store/luxel-data.ts";
import type { ResourceStore } from "../resource-store/store.ts";
import type { LoadContext } from "../resource-store/load-context.ts";
import type { CompiledApp } from "../route/compile-app.ts";
import type { TemplateBinding } from "../resource-store/luxel-data.ts";

export type BenchPoolRouteSpec = {
  slug: string;
  path: string;
  routeId: string;
  mode: AppRoute["mode"];
  revalidateSeconds?: number;
  offline: AppRoute["offline"];
  bindings: TemplateBinding[];
  precomputedHtml?: string;
  precomputedData?: LuxelDataV2;
};

export type BenchPoolArtifact = {
  appDir: string;
  manifest: Manifest;
  routes: BenchPoolRouteSpec[];
};

export const BENCH_POOL_ARTIFACT = "bench-pool.json";

export function normalizeRoutePath(path: string): string {
  if (path === "" || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export async function writeBenchPoolArtifact(app: CompiledApp): Promise<void> {
  const artifact: BenchPoolArtifact = {
    appDir: app.appDir,
    manifest: app.manifest,
    routes: app.routes.map((route) => ({
      slug: route.slug,
      path: route.path,
      routeId: route.routeId,
      mode: route.mode,
      revalidateSeconds: route.revalidateSeconds,
      offline: route.offline,
      bindings: route.bindings,
      precomputedHtml: route.precomputedHtml,
      precomputedData: route.precomputedData,
    })),
  };
  await writeFile(join(app.genRoot, BENCH_POOL_ARTIFACT), JSON.stringify(artifact));
}

type RouteModule = {
  load: (ctx: LoadContext) => Promise<void>;
  prefetch?: (ctx: LoadContext) => Promise<void>;
  renderRouteDocumentFromStore: (store: ResourceStore) => string;
};

export async function readBenchPoolIndexPrecomputedHtml(genRoot: string): Promise<string | null> {
  const raw = await readFile(join(genRoot, BENCH_POOL_ARTIFACT), "utf8");
  const artifact = JSON.parse(raw) as BenchPoolArtifact;
  const index = artifact.routes.find((route) => route.path === "/");
  return index?.precomputedHtml ?? null;
}

export async function hydrateLuxelBenchApp(
  genRoot: string,
  options: { benchFullRender?: boolean; routePaths?: string[] } = {},
): Promise<AppRuntime> {
  const raw = await readFile(join(genRoot, BENCH_POOL_ARTIFACT), "utf8");
  const artifact = JSON.parse(raw) as BenchPoolArtifact;
  const routeFilter = options.routePaths ? new Set(options.routePaths) : null;
  const routes: AppRoute[] = [];

  for (const spec of artifact.routes) {
    if (routeFilter && !routeFilter.has(spec.path)) continue;
    const mod = (await import(
      pathToFileURL(join(genRoot, "server", spec.slug, "server.mjs")).href
    )) as RouteModule;
    if (typeof mod.renderRouteDocumentFromStore !== "function") {
      throw new Error(`bundled route module missing renderRouteDocumentFromStore (${spec.slug})`);
    }

    const route: AppRoute = {
      path: spec.path,
      routeId: spec.routeId,
      mode: spec.mode,
      revalidateSeconds: spec.revalidateSeconds,
      offline: spec.offline,
      bindings: spec.bindings,
      load: (ctx) => mod.load(ctx),
      prefetch: mod.prefetch ? (ctx) => mod.prefetch!(ctx) : undefined,
      renderFromStore: (store) => mod.renderRouteDocumentFromStore(store),
      renderStreamFromStore: (store) =>
        streamHtmlDocument(mod.renderRouteDocumentFromStore(store)),
      precomputedHtml: options.benchFullRender ? undefined : spec.precomputedHtml,
      precomputedData: options.benchFullRender ? undefined : spec.precomputedData,
    };
    routes.push(route);
  }

  return {
    manifest: artifact.manifest,
    getRoute(path) {
      const normalized = normalizeRoutePath(path);
      return routes.find((r) => r.path === normalized);
    },
  };
}
