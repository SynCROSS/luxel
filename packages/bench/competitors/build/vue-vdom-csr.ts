import { build } from "vite";
import vue from "@vitejs/plugin-vue";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { COUNTER_CSR_HTML, PROD_VITE_BUILD } from "./shared.ts";
import { syncCounterSource } from "./sources.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../vue-vdom-csr");
await mkdir(join(root, "src"), { recursive: true });
await syncCounterSource("vue-vdom", root);
await writeFile(join(root, "index.html"), COUNTER_CSR_HTML);
await writeFile(
  join(root, "src/main.ts"),
  `import { createApp } from "vue";
import App from "./App.vue";
createApp(App).mount("#app");`,
);
await build({
  root,
  mode: "production",
  plugins: [vue()],
  build: {
    ...PROD_VITE_BUILD,
    outDir: join(root, "dist"),
    rollupOptions: { ...PROD_VITE_BUILD.rollupOptions, input: join(root, "index.html") },
  },
});
console.log("built vue-vdom-csr");
