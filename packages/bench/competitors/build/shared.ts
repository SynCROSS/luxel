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

export const COUNTER_APP_VUE = `<template><h1>Hello Luxel</h1><section><button type="button" data-luxel-text="count">0</button></section></template>`;

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
