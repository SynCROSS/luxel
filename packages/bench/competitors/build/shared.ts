import type { BuildOptions } from "vite";

/** Production Vite build defaults — minify, tree-shake, no dev artifacts. */
export const PROD_VITE_BUILD: NonNullable<BuildOptions> = {
  minify: "esbuild",
  sourcemap: false,
  cssMinify: true,
  reportCompressedSize: true,
  emptyOutDir: true,
  target: "es2022",
  rollupOptions: {
    treeshake: { moduleSideEffects: false, preset: "smallest" },
  },
};

export const COUNTER_CSR_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel</title></head><body><main id="app"></main><script type="module" src="/src/main.ts"></script></body></html>`;

/** Minimal package.json for SvelteKit / SolidStart adapter builds. */
export function kitPackageJson(name: string): string {
  return JSON.stringify(
    {
      name: `@luxel/bench-${name}`,
      private: true,
      type: "module",
      version: "0.0.0",
    },
    null,
    2,
  );
}

export const SVELTEKIT_POOL_BOOTSTRAP = `import { handler } from "./build/handler.js";
export async function getHandler() {
  return handler;
}
`;

export const REACT_RSC_NEXT_CONFIG = `import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  compress: false,
  generateEtags: false,
  productionBrowserSourceMaps: false,
  outputFileTracingRoot: join(appDir, "../../../.."),
  experimental: {
    optimizePackageImports: ["react", "react-dom"],
  },
};
export default nextConfig;
`;

export const REACT_RSC_BENCH_SERVER_MJS = `import { createServer } from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node:url";
import next from "next";

const dir = dirname(fileURLToPath(import.meta.url));
const app = next({ dev: false, dir });
await app.prepare();
const nextHandler = app.getRequestHandler();
const rootParsed = parse("/", true);

function benchParsedUrl(raw) {
  if (!raw || raw === "/" || raw.startsWith("/?")) return rootParsed;
  return parse(raw, true);
}

export async function startBenchServer() {
  const hostname = "127.0.0.1";
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => nextHandler(req, res, benchParsedUrl(req.url)));
    server.keepAliveTimeout = 72_000;
    server.headersTimeout = 75_000;
    server.requestTimeout = 0;
    server.listen(0, hostname, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        url: \`http://\${hostname}:\${port}\`,
        port,
        close: () => new Promise((r, j) => server.close((e) => (e ? j(e) : r()))),
      });
    });
    server.once("error", reject);
  });
}
`;

export const REACT_RSC_POOL_BOOTSTRAP = `import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node:url";
import next from "next";

const dir = dirname(fileURLToPath(import.meta.url));
const app = next({ dev: false, dir });
await app.prepare();
const nextHandler = app.getRequestHandler();
const rootParsed = parse("/", true);

function benchParsedUrl(raw) {
  if (!raw || raw === "/" || raw.startsWith("/?")) return rootParsed;
  return parse(raw, true);
}

const handler = (req, res) => nextHandler(req, res, benchParsedUrl(req.url));

export async function getHandler() {
  return handler;
}
`;

export const SOLIDSTART_POOL_BOOTSTRAP = `import { b as useNitroApp, t as toNodeListener } from "./.output/server/chunks/_/nitro.mjs";

const handler = toNodeListener(useNitroApp().h3App);

export async function getHandler() {
  return handler;
}
`;

export const BENCH_SERVER_MJS = `import { handler } from "./build/handler.js";
import { createServer } from "node:http";
export async function startBenchServer() {
  const hostname = "127.0.0.1";
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => handler(req, res, () => {}));
    server.listen(0, hostname, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        url: \`http://\${hostname}:\${port}\`,
        port,
        close: () => new Promise((r, j) => server.close((e) => (e ? j(e) : r()))),
      });
    });
    server.once("error", reject);
  });
}
`;
