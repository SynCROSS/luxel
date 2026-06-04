import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Manifest } from "../manifest/types.ts";
import type { CompiledRoute } from "../compiler/compile-route.ts";

function generateDeployEntry(manifest: Manifest, routes: CompiledRoute[]): string {
  const imports = routes
    .map((r) => `import * as route_${r.slug} from "./server/${r.slug}/server.mjs";`)
    .join("\n");
  const routeDefs = routes
    .map(
      (r) => `  {
    path: ${JSON.stringify(r.path)},
    routeId: ${JSON.stringify(r.routeId)},
    load: route_${r.slug}.load,
    renderDocument: route_${r.slug}.renderRouteDocument,
    renderStream: (data: Record<string, unknown>) =>
      streamHtmlDocument(route_${r.slug}.renderRouteDocument(data)),
  }`,
    )
    .join(",\n");

  return [
    `import { streamHtmlDocument } from "../../compiler/stream-document.ts";`,
    imports,
    ``,
    `const routes = [`,
    routeDefs,
    `];`,
    ``,
    `export const manifest = ${JSON.stringify(manifest)} as const;`,
    ``,
    `export function createDeployApp() {`,
    `  return {`,
    `    manifest,`,
    `    getRoute(path: string) {`,
    `      const normalized =`,
    `        path === "" || path === "/" ? "/" : path.endsWith("/") ? path.slice(0, -1) : path;`,
    `      return routes.find((r) => r.path === normalized);`,
    `    },`,
    `  };`,
    `}`,
  ].join("\n");
}

export async function bundleServerApp(
  genRoot: string,
  manifest: Manifest,
  routes: CompiledRoute[],
  outPath: string,
): Promise<void> {
  const entryPath = join(genRoot, "deploy-entry.ts");
  await writeFile(entryPath, generateDeployEntry(manifest, routes), "utf8");
  await mkdir(join(outPath, ".."), { recursive: true });

  const result = await Bun.build({
    entrypoints: [entryPath],
    target: "node",
    format: "esm",
    root: genRoot,
  });

  if (!result.success) {
    throw new Error(result.logs.map((l) => l.message).join("\n"));
  }

  await writeFile(outPath, await result.outputs[0]!.text(), "utf8");
}
