import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ASSET_CLIENT, codegenSsrDocument, codegenSsrDocumentFromBody, type CodegenSsrOptions } from "./codegen-ssr.ts";
import { codegenAttachModule } from "./codegen-attach.ts";
import { codegenClientGlue } from "./codegen-client-glue.ts";
import { streamHtmlDocument } from "./stream-document.ts";
import type { TemplateBinding } from "../resource-store/luxel-data.ts";
import { projectSnapshotToTemplateData } from "../resource-store/project-bindings.ts";
import { ResourceStore } from "../resource-store/store.ts";
import { createLoadContext } from "../resource-store/load-context.ts";
import { LUXEL_DATA_VERSION, type LuxelDataV2 } from "../resource-store/luxel-data.ts";
import type { Manifest } from "../manifest/types.ts";
import type { RenderIr } from "./render-ir.ts";
import type { LoadContext } from "../resource-store/load-context.ts";
import type { BundleBackend } from "../host/backends/types.ts";
import { bundleEsm } from "../build/bundle-esm.ts";
import { pickBundleBackend } from "../build/pick-bundle-backend.ts";
import { analyzeRouteSfc } from "./analyze-route-sfc.ts";
import type { ClientHydration } from "./analyze-script.ts";
import {
  codegenCompiledRenderModule,
  codegenPrecomputedWithFallbackCompiledModule,
  renderIrHasForLoop,
} from "./codegen-compiled-ssr.ts";
import {
  codegenDynamicRenderModule,
  codegenPrecomputedWithFallbackModule,
  codegenServerModuleSrc,
} from "./codegen-route-runtime.ts";
import { assertNativeSsrEligible, nativeSsrRouteKind, type NativeSsrRouteKind } from "./spiral-native.ts";
import { renderSpiralRouteDocumentFromStore } from "../luxel-core/spiral-native.ts";
import { renderCounterBodyFromStore } from "../luxel-core/counter-native.ts";

export type CompileRouteOptions = {
  routeId: string;
  path: string;
  source: string;
  componentId: string;
  slug: string;
  genRoot: string;
  bundleBackend?: BundleBackend;
  configClientHydration?: ClientHydration;
  ssrBackend?: "ts" | "native";
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

export async function compileRoute(sfcPath: string, options: CompileRouteOptions): Promise<CompiledRoute> {
  const source = await readFile(sfcPath, "utf8");
  const analysis = analyzeRouteSfc(source, options.routeId, {
    configClientHydration: options.configClientHydration,
  });
  const { renderIr, sfc, bindings, mode, offline, script } = analysis;
  const ssrBackend = options.ssrBackend ?? "ts";
  const nativeKind = ssrBackend === "native" ? nativeSsrRouteKind(renderIr) : null;
  if (ssrBackend === "native") {
    assertNativeSsrEligible(renderIr);
  }

  const codegenOpts: CodegenSsrOptions = {
    routePath: options.path,
    routeId: options.routeId,
    clientModule: `client/routes/${options.slug}.js`,
    shipClientRuntime: analysis.shipSidecars.clientScript,
    shipDataSidecar: analysis.shipSidecars.data,
    shipHydrationSidecar: analysis.shipSidecars.hydration,
  };

  const attachModuleSrc = analysis.hasClientBundle ? codegenAttachModule(renderIr) : null;
  const scriptPrefix = analysis.hasClientBundle
    ? `import { signal } from "../../../../runtime/signal.ts";\n`
    : "";
  const glue = analysis.hasClientBundle
    ? `\n\n${codegenClientGlue(`./${options.slug}.attach.ts`, analysis.handlerSymbols)}`
    : "";
  const clientModuleSrc = `${scriptPrefix}${sfc.script.trim()}${glue}`;

  const useCompiledListSsr = renderIrHasForLoop(renderIr.domOps);
  let renderModuleSrc = useCompiledListSsr
    ? codegenCompiledRenderModule(renderIr, codegenOpts, bindings)
    : codegenDynamicRenderModule(renderIr, codegenOpts, bindings);
  let serverModuleSrc = codegenServerModuleSrc(sfc.script, renderModuleSrc, analysis.hasClientBundle);

  const serverFnNames = script.serverFnNames;
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
    hasPrefetch: script.hasPrefetch,
    bindings,
    ...(script.revalidateSeconds !== undefined ? { revalidateSeconds: script.revalidateSeconds } : {}),
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
    client: { hydration: analysis.clientHydration },
    shipSidecars: analysis.shipSidecars,
    ...(ssrBackend === "native" ? { ssr: "native" as const } : {}),
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
    revalidateSeconds: script.revalidateSeconds,
    offline,
    renderIr,
    manifestRoute,
    manifestComponent,
    hasClientBundle: analysis.hasClientBundle,
    shipClientRuntime: analysis.shipClientRuntime,
    attachModuleSrc,
    clientModuleSrc,
    serverModuleSrc,
    bindings,
    renderFromStore: () => "",
    renderStreamFromStore: () => new ReadableStream(),
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
    serverModuleSrc,
    serverFnNames,
    bundleBackend,
    options.genRoot,
  );
  compiled.load = routeFns.load;
  compiled.prefetch = routeFns.prefetch;
  compiled.serverFunctions = serverFunctions;
  compiled.callServerFn = routeFns.callServerFn;
  compiled.renderFromStore = wrapRenderFromStore(
    routeFns.renderFromStore,
    ssrBackend,
    nativeKind,
    renderIr,
    codegenOpts,
    bindings,
  );
  compiled.renderStreamFromStore = (store) =>
    streamHtmlDocument(compiled.renderFromStore(store));

  if (script.staticLoadEligible && ssrBackend !== "native") {
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
    renderModuleSrc = useCompiledListSsr
      ? codegenPrecomputedWithFallbackCompiledModule(
          renderIr,
          codegenOpts,
          bindings,
          { html: compiled.precomputedHtml, data: compiled.precomputedData },
        )
      : codegenPrecomputedWithFallbackModule(
          renderIr,
          codegenOpts,
          bindings,
          { html: compiled.precomputedHtml, data: compiled.precomputedData },
        );
    serverModuleSrc = codegenServerModuleSrc(sfc.script, renderModuleSrc, analysis.hasClientBundle);
    compiled.serverModuleSrc = serverModuleSrc;
    await writeFile(join(serverDir, "server-entry.ts"), serverModuleSrc, "utf8");
    const refreshed = await createRouteFns(
      serverDir,
      serverModuleSrc,
      serverFnNames,
      bundleBackend,
      options.genRoot,
    );
    compiled.load = refreshed.load;
    compiled.prefetch = refreshed.prefetch;
    compiled.callServerFn = refreshed.callServerFn;
    compiled.renderFromStore = wrapRenderFromStore(
      refreshed.renderFromStore,
      ssrBackend,
      nativeKind,
      renderIr,
      codegenOpts,
      bindings,
    );
    compiled.renderStreamFromStore = (store) =>
      streamHtmlDocument(compiled.renderFromStore(store));
  }

  return compiled;
}

function wrapRenderFromStore(
  tsRender: (store: ResourceStore) => string,
  ssrBackend: "ts" | "native",
  nativeKind: NativeSsrRouteKind | null,
  renderIr: RenderIr,
  codegenOpts: CodegenSsrOptions,
  bindings: TemplateBinding[],
): (store: ResourceStore) => string {
  if (ssrBackend !== "native" || !nativeKind) {
    return tsRender;
  }
  return (store) => {
    try {
      if (nativeKind === "spiral") {
        return renderSpiralRouteDocumentFromStore(store);
      }
      const body = renderCounterBodyFromStore(store, renderIr, bindings);
      return codegenSsrDocumentFromBody(
        body,
        store.snapshot(),
        codegenOpts,
        bindings,
        renderIr.boundaryIds,
        renderIr.headStyle,
      );
    } catch (err) {
      if (process.env.LUXEL_BENCH_STRICT_NATIVE === "1") {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`luxel-core native SSR required in bench but failed: ${msg}`);
      }
      return tsRender(store);
    }
  };
}

type RouteFns = {
  load: (ctx: LoadContext) => Promise<void>;
  prefetch?: (ctx: LoadContext) => Promise<void>;
  callServerFn: (name: string, input: unknown) => Promise<unknown>;
  renderFromStore: (store: ResourceStore) => string;
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
  const renderFromStore = mod.renderRouteDocumentFromStore;
  if (typeof renderFromStore !== "function") {
    throw new Error("bundled route module missing renderRouteDocumentFromStore");
  }
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
    renderFromStore: (store) => (renderFromStore as (store: ResourceStore) => string)(store),
  };
}
