import { defineConfig } from "@solidjs/start/config";
export default defineConfig({
  ssr: true,
  server: { preset: "node-server" },
  vite: { build: { minify: "esbuild", sourcemap: false, target: "es2022" } },
});