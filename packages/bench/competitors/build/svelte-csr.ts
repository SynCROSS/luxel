import { build } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { PROD_VITE_BUILD } from "./shared.ts";
import { syncCounterSource } from "./sources.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../svelte-csr");
await mkdir(join(root, "src"), { recursive: true });
await syncCounterSource("svelte", root);
await writeFile(
  join(root, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel</title></head><body><main id="app"></main><script type="module" src="/src/main.ts"></script></body></html>`,
);
await writeFile(
  join(root, "src/main.ts"),
  `import { mount } from "svelte";
import App from "./App.svelte";
mount(App, { target: document.getElementById("app")! });`,
);
await build({
  root,
  mode: "production",
  plugins: [svelte({ compilerOptions: { dev: false } })],
  build: {
    ...PROD_VITE_BUILD,
    outDir: join(root, "dist"),
    rollupOptions: { ...PROD_VITE_BUILD.rollupOptions, input: join(root, "index.html") },
  },
});
console.log("built svelte-csr");
