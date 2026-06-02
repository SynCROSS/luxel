import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compileSemanticIr } from "./semantic-ir.ts";
import { lowerToRenderIr } from "./render-ir.ts";
import { codegenSsrDocument, ASSET_CLIENT, type CodegenSsrOptions } from "./codegen-ssr.ts";
import { codegenAttachModule } from "./codegen-attach.ts";
import { codegenClientGlue } from "./codegen-client-glue.ts";
import { parseSfc } from "./parse-sfc.ts";
import { streamHtmlDocument } from "./stream-document.ts";
import type { Manifest } from "../manifest/types.ts";
import type { RenderIr } from "./render-ir.ts";

const pkgSrc = join(dirname(fileURLToPath(import.meta.url)), "..");

export type CompileRouteOptions = {
  routeId: string;
  path: string;
  source: string;
  componentId: string;
  slug: string;
  genRoot: string;
};

export type CompiledRoute = {
  slug: string;
  path: string;
  routeId: string;
  renderIr: RenderIr;
  manifestRoute: Manifest["routes"][number];
  manifestComponent: Manifest["components"][number];
  hasClientBundle: boolean;
  attachModuleSrc: string | null;
  clientModuleSrc: string;
  serverModuleSrc: string;
  renderDocument: (data: Record<string, unknown>) => string;
  renderStream: (data: Record<string, unknown>) => ReadableStream<Uint8Array>;
  load: () => Promise<Record<string, unknown>>;
  writeCacheFiles: () => Promise<void>;
};

export async function compileRoute(sfcPath: string, options: CompileRouteOptions): Promise<CompiledRoute> {
  const source = await readFile(sfcPath, "utf8");
  const semantic = compileSemanticIr(source);
  const renderIr = lowerToRenderIr(semantic, source);
  const sfc = parseSfc(source);
  const hasClientBundle = renderIr.boundaryIds.length > 0;

  const codegenOpts: CodegenSsrOptions = {
    routePath: options.path,
    routeId: options.routeId,
    clientModule: `client/routes/${options.slug}.js`,
  };

  const renderDocument = (data: Record<string, unknown>) =>
    codegenSsrDocument(renderIr, data, codegenOpts);
  const renderStream = (data: Record<string, unknown>) => streamHtmlDocument(renderDocument(data));

  const attachModuleSrc = hasClientBundle ? codegenAttachModule(renderIr) : null;
  const scriptPrefix = hasClientBundle ? `import { signal } from "../../../../runtime/signal.ts";\n` : "";
  const glue = hasClientBundle ? `\n\n${codegenClientGlue(`./${options.slug}.attach.ts`)}` : "";
  const clientModuleSrc = `${scriptPrefix}${sfc.script.trim()}${glue}`;

  const ssrOptsJson = JSON.stringify(codegenOpts);
  const renderModuleSrc = [
    `import { codegenSsrDocument } from "../../../../compiler/codegen-ssr.ts";`,
    `import type { RenderIr } from "../../../../compiler/render-ir.ts";`,
    ``,
    `const renderIr = ${JSON.stringify(renderIr)} as RenderIr;`,
    `const codegenOpts = ${ssrOptsJson} as const;`,
    ``,
    `export function renderRouteDocument(data: Record<string, unknown>): string {`,
    `  return codegenSsrDocument(renderIr, data, codegenOpts);`,
    `}`,
  ].join("\n");

  const serverImports = hasClientBundle ? `import { signal } from "../../../../runtime/signal.ts";\n` : "";
  const serverModuleSrc = [
    serverImports,
    sfc.script.trim(),
    ``,
    renderModuleSrc,
    ``,
    `export async function render(ctx: { data: Awaited<ReturnType<typeof load>> }) {`,
    `  return renderRouteDocument(ctx.data as Record<string, unknown>);`,
    `}`,
  ].join("\n");

  const manifestRoute: Manifest["routes"][number] = {
    id: options.routeId,
    path: options.path,
    source: options.source,
    mode: "ssr",
    hasLoad: true,
    serverModule: `server/routes/${options.slug}.js`,
    clientModule: `client/routes/${options.slug}.js`,
    hydration: renderIr.boundaryIds.map((id) => ({
      id,
      directive: "load",
      componentId: options.componentId,
    })),
    assets: { client: `assets/${ASSET_CLIENT}` },
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
    renderIr,
    manifestRoute,
    manifestComponent,
    hasClientBundle,
    attachModuleSrc,
    clientModuleSrc,
    serverModuleSrc,
    renderDocument,
    renderStream,
    load: async () => ({}),
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
      await writeFile(join(serverDir, "server-entry.ts"), serverModuleSrc, "utf8");
    },
  };

  compiled.load = await createLoadFn(serverDir, serverModuleSrc);
  return compiled;
}

async function createLoadFn(
  serverDir: string,
  serverModuleSrc: string,
): Promise<() => Promise<Record<string, unknown>>> {
  await mkdir(serverDir, { recursive: true });
  const entry = join(serverDir, "server-entry.ts");
  await writeFile(entry, serverModuleSrc, "utf8");
  const result = await Bun.build({
    entrypoints: [entry],
    target: "bun",
    format: "esm",
  });
  if (!result.success) {
    throw new Error(result.logs.map((l) => l.message).join("\n"));
  }
  const outPath = join(serverDir, "server.mjs");
  await writeFile(outPath, await result.outputs[0]!.text(), "utf8");
  const mod = (await import(outPath)) as { load: () => Promise<Record<string, unknown>> };
  return () => mod.load();
}
