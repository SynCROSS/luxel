import { build } from "vite";
import solid from "vite-plugin-solid";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { PROD_VITE_BUILD } from "./shared.ts";
import { syncCounterSource } from "./sources.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../solid-csr");
await mkdir(join(root, "src"), { recursive: true });
await syncCounterSource("solid", root);
await writeFile(
  join(root, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel</title></head><body><main id="app"></main><script type="module" src="/src/main.ts"></script></body></html>`,
);
await writeFile(
  join(root, "src/main.ts"),
  `import { render } from "solid-js/web";
import { CounterApp } from "./App.ts";
render(CounterApp, document.getElementById("app")!);`,
);
await build({
  root,
  mode: "production",
  plugins: [solid({ ssr: false })],
  esbuild: { jsx: "automatic", jsxImportSource: "solid-js" },
  build: {
    ...PROD_VITE_BUILD,
    outDir: join(root, "dist"),
    rollupOptions: { ...PROD_VITE_BUILD.rollupOptions, input: join(root, "index.html") },
  },
});
console.log("built solid-csr");
