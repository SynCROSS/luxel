import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { createStaticServer, type BenchServer } from "../http-server.ts";

const competitorsRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../competitors");

function distDir(app: string): string {
  return join(competitorsRoot, app, "dist");
}

export async function startCsrFromDist(app: string): Promise<BenchServer | null> {
  const root = distDir(app);
  if (!existsSync(join(root, "index.html"))) return null;
  return createStaticServer(root);
}

export async function startReactCsrServer(): Promise<BenchServer | null> {
  return startCsrFromDist("react-csr");
}

export async function startVueCsrServer(): Promise<BenchServer | null> {
  return startCsrFromDist("vue-vdom-csr") ?? startCsrFromDist("vue-csr");
}

export async function startVueVaporCsrServer(): Promise<BenchServer | null> {
  return startCsrFromDist("vue-vapor-csr");
}

export async function startSolidCsrServer(): Promise<BenchServer | null> {
  return startCsrFromDist("solid-csr");
}

export async function startSvelteCsrServer(): Promise<BenchServer | null> {
  return startCsrFromDist("svelte-csr");
}

export async function startReactRscServer(): Promise<BenchServer | null> {
  return startFrameworkProdServer("react-rsc");
}

export async function startReactRscWorkerPoolServer(): Promise<BenchServer | null> {
  return startFrameworkProdServer("react-rsc", { workerPool: true });
}

export async function startSolidStartSsrServer(): Promise<BenchServer | null> {
  return startFrameworkProdServer("solidstart-ssr");
}

export async function startSolidStartSsrWorkerPoolServer(): Promise<BenchServer | null> {
  return startFrameworkProdServer("solidstart-ssr", { workerPool: true });
}

export async function startSvelteKitSsrServer(): Promise<BenchServer | null> {
  return startFrameworkProdServer("sveltekit-ssr");
}

export async function startSvelteKitSsrWorkerPoolServer(): Promise<BenchServer | null> {
  return startFrameworkProdServer("sveltekit-ssr", { workerPool: true });
}

export async function startSvelteKitIsrServer(): Promise<BenchServer | null> {
  return startFrameworkProdServer("sveltekit-isr");
}

export async function startSvelteKitIsrWorkerPoolServer(): Promise<BenchServer | null> {
  return startFrameworkProdServer("sveltekit-isr", { workerPool: true });
}

type ProdServerOpts = {
  workerPool?: boolean;
};

async function startFrameworkProdServer(
  app: string,
  opts: ProdServerOpts = {},
): Promise<BenchServer | null> {
  const appDir = join(competitorsRoot, app);
  const handlerPath = join(appDir, ".bench-server.mjs");
  if (!existsSync(handlerPath)) return null;
  if (app === "react-rsc" && !existsSync(join(appDir, ".next", "BUILD_ID"))) return null;
  if (app.startsWith("sveltekit") && !existsSync(join(appDir, "build", "handler.js"))) return null;
  if (app === "solidstart-ssr" && !existsSync(join(appDir, ".output", "server", "index.mjs"))) return null;

  if (opts.workerPool) {
    const bootstrapPath = join(appDir, ".bench-pool-bootstrap.mjs");
    if (!existsSync(bootstrapPath)) return null;
    if (app === "react-rsc" || app === "solidstart-ssr") {
      const mod = await import(handlerPath);
      if (typeof mod.startBenchServer !== "function") return null;
      return mod.startBenchServer() as Promise<BenchServer>;
    }
    const { startPooledNodeBenchServer } = await import("../../prod-worker-pool/start-pooled-node-server.ts");
    return startPooledNodeBenchServer({
      bootstrapPath,
      isrCacheMs: app === "sveltekit-isr" ? 1000 : undefined,
    });
  }

  const mod = await import(handlerPath);
  if (typeof mod.startBenchServer !== "function") return null;
  return mod.startBenchServer() as Promise<BenchServer>;
}

export { competitorsRoot };
