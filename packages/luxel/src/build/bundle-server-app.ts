import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Manifest } from "../manifest/types.ts";
import type { CompiledRoute } from "../compiler/compile-route.ts";
import type { BundleBackend } from "../host/backends/types.ts";
import { bundleEsm } from "./bundle-esm.ts";
import { pickBundleBackend } from "./pick-bundle-backend.ts";

function generateDeployEntry(manifest: Manifest, routes: CompiledRoute[]): string {
  const imports = routes
    .map((r) => `import * as route_${r.slug} from "./server/${r.slug}/server.mjs";`)
    .join("\n");
  const routeDefs = routes
    .map(
      (r) => `  {
    path: ${JSON.stringify(r.path)},
    routeId: ${JSON.stringify(r.routeId)},
    mode: ${JSON.stringify(r.manifestRoute.mode)},
    revalidateSeconds: ${r.revalidateSeconds ?? "undefined"},
    offline: ${JSON.stringify(r.manifestRoute.offline)},
    bindings: ${JSON.stringify(r.bindings)},
    load: route_${r.slug}.load,
${r.prefetch ? `    prefetch: route_${r.slug}.prefetch,\n` : ""}    renderFromStore: route_${r.slug}.renderRouteDocumentFromStore,
    renderStreamFromStore: (store) =>
      streamHtmlDocument(route_${r.slug}.renderRouteDocumentFromStore(store)),
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
  backend: BundleBackend = pickBundleBackend(),
): Promise<void> {
  const entryPath = join(genRoot, "deploy-entry.ts");
  await writeFile(entryPath, generateDeployEntry(manifest, routes), "utf8");
  await mkdir(join(outPath, ".."), { recursive: true });

  const [output] = await bundleEsm(backend, [entryPath], {
    root: genRoot,
    platform: "node",
    write: false,
  });
  await writeFile(outPath, output.text, "utf8");
}
