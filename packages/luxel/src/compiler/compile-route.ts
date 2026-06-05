import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compileSemanticIr } from "./semantic-ir.ts";
import { lowerToRenderIr } from "./render-ir.ts";
import { codegenSsrDocument, ASSET_CLIENT, type CodegenSsrOptions } from "./codegen-ssr.ts";
import { codegenAttachModule } from "./codegen-attach.ts";
import { codegenClientGlue } from "./codegen-client-glue.ts";
import { parseSfc } from "./parse-sfc.ts";
import { streamHtmlDocument } from "./stream-document.ts";
import { inferTemplateBindings } from "./infer-bindings.ts";
import type { TemplateBinding } from "../resource-store/luxel-data.ts";
import type { ResourceStore } from "../resource-store/store.ts";
import {
  projectSnapshotToTemplateData,
  projectStoreToTemplateData,
} from "../resource-store/project-bindings.ts";
import { ResourceStore } from "../resource-store/store.ts";
import { createLoadContext } from "../resource-store/load-context.ts";
import { LUXEL_DATA_VERSION, type LuxelDataV2 } from "../resource-store/luxel-data.ts";
import type { Manifest } from "../manifest/types.ts";
import type { RenderIr } from "./render-ir.ts";
import type { LoadContext } from "../resource-store/load-context.ts";
import { inferStaticLoad } from "./infer-static-load.ts";
import type { BundleBackend } from "../host/backends/types.ts";
import { bundleEsm } from "../build/bundle-esm.ts";
import { pickBundleBackend } from "../build/pick-bundle-backend.ts";

export type CompileRouteOptions = {
  routeId: string;
  path: string;
  source: string;
  componentId: string;
  slug: string;
  genRoot: string;
  bundleBackend?: BundleBackend;
};

export type CompiledRoute = {
  slug: string;
  path: string;
  routeId: string;
  mode: "ssr" | "ssg" | "isr";
  revalidateSeconds?: number;
  offline: "none" | "static" | "stale" | "custom";
  renderIr: RenderIr;
  manifestRoute: Manifest["routes"][number];
  manifestComponent: Manifest["components"][number];
  hasClientBundle: boolean;
  shipClientRuntime: boolean;
  attachModuleSrc: string | null;
  clientModuleSrc: string;
  serverModuleSrc: string;
  bindings: TemplateBinding[];
  renderFromStore: (store: ResourceStore) => string;
  renderStreamFromStore: (store: ResourceStore) => ReadableStream<Uint8Array>;
  precomputedHtml?: string;
  precomputedData?: LuxelDataV2;
  load: (ctx: LoadContext) => Promise<void>;
  prefetch?: (ctx: LoadContext) => Promise<void>;
  serverFunctions: Array<{ id: string; name: string }>;
  callServerFn: (name: string, input: unknown) => Promise<unknown>;
  writeCacheFiles: () => Promise<void>;
};

const RESERVED_SERVER_EXPORTS = new Set(["load", "prefetch"]);

function inferOfflineMode(
  mode: "ssr" | "ssg" | "isr",
  override?: "none" | "static" | "stale" | "custom",
): "none" | "static" | "stale" | "custom" {
  if (override) return override;
  if (mode === "ssg") return "static";
  if (mode === "isr") return "stale";
  return "none";
}

function parseOfflineExport(script: string): "none" | "static" | "stale" | "custom" | undefined {
  const match = /export\s+const\s+offline\s*=\s*"(none|static|stale|custom)"/.exec(script);
  return match ? (match[1] as "none" | "static" | "stale" | "custom") : undefined;
}

function resourceSnapshotsEqual(
  a: import("../resource-store/types.ts").ResourceSnapshot,
  b: import("../resource-store/types.ts").ResourceSnapshot,
): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
    const left = a[aKeys[i]!]!;
    const right = b[bKeys[i]!]!;
    if (left.generation !== right.generation) return false;
    if (JSON.stringify(left.value) !== JSON.stringify(right.value)) return false;
  }
  return true;
}

function discoverServerFunctions(script: string): string[] {
  const names: string[] = [];
  for (const match of script.matchAll(/export\s+async\s+function\s+(\w+)\s*\(/g)) {
    const name = match[1]!;
    if (!RESERVED_SERVER_EXPORTS.has(name)) names.push(name);
  }
  return names;
}

export async function compileRoute(sfcPath: string, options: CompileRouteOptions): Promise<CompiledRoute> {
  const source = await readFile(sfcPath, "utf8");
  const semantic = compileSemanticIr(source);
  const renderIr = lowerToRenderIr(semantic, source);
  const sfc = parseSfc(source);
  const hasClientBundle = renderIr.boundaryIds.length > 0;
  const hasClientNav = /data-luxel-nav/.test(sfc.template);
  const shipClientRuntime = hasClientBundle || hasClientNav;

  const codegenOpts: CodegenSsrOptions = {
    routePath: options.path,
    routeId: options.routeId,
    clientModule: `client/routes/${options.slug}.js`,
    shipClientRuntime,
  };

  const bindings = inferTemplateBindings(options.routeId, semantic, sfc.script);
  const renderFromStore = (store: ResourceStore) => {
    const templateData = projectStoreToTemplateData(store, bindings);
    return codegenSsrDocument(renderIr, templateData, store.snapshot(), codegenOpts, bindings);
  };
  const renderStreamFromStore = (store: ResourceStore) =>
    streamHtmlDocument(renderFromStore(store));
  const hasPrefetch = /\bexport\s+async\s+function\s+prefetch\s*\(/m.test(sfc.script);
  const prerender =
    /export\s+const\s+prerender\s*=\s*true\b/.test(sfc.script) &&
    !/export\s+const\s+prerender\s*=\s*false\b/.test(sfc.script);
  const revalidateMatch = /export\s+const\s+revalidate\s*=\s*(\d+)/.exec(sfc.script);
  const revalidateSeconds = revalidateMatch ? Number(revalidateMatch[1]) : undefined;
  const readsSession = /\bctx\.session\b/.test(sfc.script);
  const mode = readsSession
    ? "ssr"
    : prerender
      ? "ssg"
      : revalidateSeconds !== undefined
        ? "isr"
        : "ssr";
  const offline = inferOfflineMode(mode, parseOfflineExport(sfc.script));

  const attachModuleSrc = hasClientBundle ? codegenAttachModule(renderIr) : null;
  const scriptPrefix = hasClientBundle ? `import { signal } from "../../../../runtime/signal.ts";\n` : "";
  const glue = hasClientBundle ? `\n\n${codegenClientGlue(`./${options.slug}.attach.ts`)}` : "";
  const clientModuleSrc = `${scriptPrefix}${sfc.script.trim()}${glue}`;

  const staticLoad = inferStaticLoad(sfc.script);
  const ssrOptsJson = JSON.stringify(codegenOpts);
  const bindingsJson = JSON.stringify(bindings);
  const dynamicRenderModuleSrc = [
    `import { codegenSsrDocument } from "../../../../compiler/codegen-ssr.ts";`,
    `import { projectSnapshotToTemplateData } from "../../../../resource-store/project-bindings.ts";`,
    `import type { ResourceStore } from "../../../../resource-store/store.ts";`,
    `import type { RenderIr } from "../../../../compiler/render-ir.ts";`,
    ``,
    `const renderIr = ${JSON.stringify(renderIr)} as RenderIr;`,
    `const codegenOpts = ${ssrOptsJson} as const;`,
    `const BINDING_MAP = ${bindingsJson} as const;`,
    ``,
    `export function renderRouteDocumentFromStore(store: ResourceStore): string {`,
    `  const snapshot = store.snapshot();`,
    `  const templateData = projectSnapshotToTemplateData(snapshot, BINDING_MAP);`,
    `  return codegenSsrDocument(renderIr, templateData, snapshot, codegenOpts, BINDING_MAP);`,
    `}`,
  ].join("\n");

  const serverImports = hasClientBundle ? `import { signal } from "../../../../runtime/signal.ts";\n` : "";
  const serverModuleSrc = [
    serverImports,
    sfc.script.trim(),
    ``,
    dynamicRenderModuleSrc,
    ``,
  ].join("\n");

  const serverFnNames = discoverServerFunctions(sfc.script);
  const serverFunctions = serverFnNames.map((name) => ({
    id: `${options.routeId}:${name}`,
    name,
  }));

  const manifestRoute: Manifest["routes"][number] = {
    id: options.routeId,
    path: options.path,
    source: options.source,
    mode,
    hasLoad: true,
    hasPrefetch,
    bindings,
    ...(revalidateSeconds !== undefined ? { revalidateSeconds } : {}),
    offline,
    serverModule: `server/routes/${options.slug}.js`,
    clientModule: `client/routes/${options.slug}.js`,
    hydration: renderIr.boundaryIds.map((id) => ({
      id,
      directive: "load",
      componentId: options.componentId,
    })),
    assets: { client: `assets/${ASSET_CLIENT}` },
    ...(serverFunctions.length > 0 ? { serverFunctions } : {}),
  };

  const manifestComponent: Manifest["components"][number] = {
    id: options.componentId,
    source: options.source,
  };

  const serverDir = join(options.genRoot, "server", options.slug);

  const compiled: CompiledRoute = {
    slug: options.slug,
    path: options.path,
    routeId: options.routeId,
    mode,
    revalidateSeconds,
    offline,
    renderIr,
    manifestRoute,
    manifestComponent,
    hasClientBundle,
    shipClientRuntime,
    attachModuleSrc,
    clientModuleSrc,
    serverModuleSrc,
    bindings,
    renderFromStore,
    renderStreamFromStore,
    load: async () => {},
    serverFunctions: [],
    callServerFn: async () => {
      throw new Error("server function not wired");
    },
    writeCacheFiles: async () => {
      await mkdir(join(options.genRoot, "client/routes"), { recursive: true });
      await mkdir(serverDir, { recursive: true });
      await writeFile(join(options.genRoot, "client/routes", `${options.slug}.ts`), clientModuleSrc, "utf8");
      if (attachModuleSrc) {
        await writeFile(
          join(options.genRoot, "client/routes", `${options.slug}.attach.ts`),
          attachModuleSrc,
          "utf8",
        );
      }
      await writeFile(join(serverDir, "server-entry.ts"), compiled.serverModuleSrc, "utf8");
    },
  };

  const bundleBackend = options.bundleBackend ?? pickBundleBackend();
  const routeFns = await createRouteFns(
    serverDir,
    compiled.serverModuleSrc,
    serverFnNames,
    bundleBackend,
    options.genRoot,
  );
  compiled.load = routeFns.load;
  compiled.prefetch = routeFns.prefetch;
  compiled.serverFunctions = serverFunctions;
  compiled.callServerFn = routeFns.callServerFn;

  if (staticLoad) {
    const warmStore = new ResourceStore();
    const warmCtx = createLoadContext(warmStore, null);
    if (routeFns.prefetch) await routeFns.prefetch(warmCtx);
    await routeFns.load(warmCtx);
    const resources = warmStore.snapshot();
    const templateData = projectSnapshotToTemplateData(resources, bindings);
    compiled.precomputedData = { version: LUXEL_DATA_VERSION, resources };
    compiled.precomputedHtml = codegenSsrDocument(
      renderIr,
      templateData,
      resources,
      codegenOpts,
      bindings,
    );
    const renderModuleSrc = [
      `import type { ResourceStore } from "../../../../resource-store/store.ts";`,
      ``,
      `const PRECOMPUTED_HTML = ${JSON.stringify(compiled.precomputedHtml)};`,
      ``,
      `export function renderRouteDocumentFromStore(_store: ResourceStore): string {`,
      `  return PRECOMPUTED_HTML;`,
      `}`,
    ].join("\n");
    compiled.serverModuleSrc = [serverImports, sfc.script.trim(), ``, renderModuleSrc, ``].join("\n");
    await writeFile(join(serverDir, "server-entry.ts"), compiled.serverModuleSrc, "utf8");
    await writeServerBundle(
      bundleBackend,
      options.genRoot,
      serverDir,
      join(serverDir, "server-entry.ts"),
    );
    const renderDynamic = (store: ResourceStore) => {
      const snapshot = store.snapshot();
      const templateData = projectSnapshotToTemplateData(snapshot, bindings);
      return codegenSsrDocument(renderIr, templateData, snapshot, codegenOpts, bindings);
    };
    const precomputedResources = resources;
    compiled.renderFromStore = (store) => {
      const snapshot = store.snapshot();
      if (resourceSnapshotsEqual(snapshot, precomputedResources)) {
        return compiled.precomputedHtml!;
      }
      return renderDynamic(store);
    };
    compiled.renderStreamFromStore = (store) =>
      streamHtmlDocument(compiled.renderFromStore(store));
  }

  return compiled;
}

type RouteFns = {
  load: (ctx: LoadContext) => Promise<void>;
  prefetch?: (ctx: LoadContext) => Promise<void>;
  callServerFn: (name: string, input: unknown) => Promise<unknown>;
};

async function writeServerBundle(
  backend: BundleBackend,
  genRoot: string,
  serverDir: string,
  entry: string,
): Promise<string> {
  const outPath = join(serverDir, "server.mjs");
  const [output] = await bundleEsm(backend, [entry], {
    root: join(genRoot, "../.."),
    platform: backend.id === "bun" ? "bun" : "node",
    write: false,
  });
  await writeFile(outPath, output.text, "utf8");
  return outPath;
}

async function createRouteFns(
  serverDir: string,
  serverModuleSrc: string,
  serverFnNames: string[],
  bundleBackend: BundleBackend,
  genRoot: string,
): Promise<RouteFns> {
  await mkdir(serverDir, { recursive: true });
  const entry = join(serverDir, "server-entry.ts");
  await writeFile(entry, serverModuleSrc, "utf8");
  const outPath = await writeServerBundle(bundleBackend, genRoot, serverDir, entry);
  const mod = (await import(pathToFileURL(outPath).href)) as Record<string, unknown>;
  return {
    load: (ctx) => (mod.load as (ctx: LoadContext) => Promise<void>)(ctx),
    prefetch: mod.prefetch
      ? (ctx) => (mod.prefetch as (ctx: LoadContext) => Promise<void>)(ctx)
      : undefined,
    callServerFn: async (name, input) => {
      if (!serverFnNames.includes(name)) {
        throw new Error(`unknown server function: ${name}`);
      }
      const fn = mod[name];
      if (typeof fn !== "function") {
        throw new Error(`server function export missing: ${name}`);
      }
      return await (fn as (input: unknown) => Promise<unknown>)(input);
    },
  };
}
