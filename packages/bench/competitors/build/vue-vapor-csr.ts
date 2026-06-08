import { build } from "vite";
import vue from "@vitejs/plugin-vue";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { COUNTER_CSR_HTML, PROD_VITE_BUILD } from "./shared.ts";
import { syncCounterSource } from "./sources.ts";

const competitorsDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const vueVaporRoot = dirname(require.resolve("vue-vapor/package.json"));

const root = join(competitorsDir, "vue-vapor-csr");
await mkdir(join(root, "src"), { recursive: true });
await syncCounterSource("vue-vapor", root);
await writeFile(join(root, "index.html"), COUNTER_CSR_HTML);
await writeFile(
  join(root, "src/main.ts"),
  `import { createVaporApp } from "vue-vapor";
import App from "./App.vue";
createVaporApp(App).mount("#app");`,
);
await build({
  root,
  mode: "production",
  resolve: {
    alias: { vue: vueVaporRoot },
  },
  plugins: [
    vue({
      isProduction: true,
      compiler: await import("vue-vapor/compiler-sfc"),
      features: { optionsAPI: false },
    }),
  ],
  build: {
    ...PROD_VITE_BUILD,
    outDir: join(root, "dist"),
    rollupOptions: { ...PROD_VITE_BUILD.rollupOptions, input: join(root, "index.html") },
  },
});
console.log("built vue-vapor-csr");
