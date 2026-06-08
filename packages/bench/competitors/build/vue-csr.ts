import { build } from "vite";
import vue from "@vitejs/plugin-vue";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";

const root = join(dirname(fileURLToPath(import.meta.url)), "../vue-csr");
await mkdir(join(root, "src"), { recursive: true });
await writeFile(
  join(root, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel</title></head><body><main id="app"></main><script type="module" src="/src/main.ts"></script></body></html>`,
);
await writeFile(
  join(root, "src/App.vue"),
  `<template><h1>Hello Luxel</h1><section><button type="button" data-luxel-text="count">0</button></section></template>`,
);
await writeFile(join(root, "src/main.ts"), `import { createApp } from "vue"; import App from "./App.vue"; createApp(App).mount("#app");`);
await build({
  root,
  plugins: [vue()],
  build: { outDir: join(root, "dist"), emptyOutDir: true, rollupOptions: { input: join(root, "index.html") } },
});
console.log("built vue-csr");
