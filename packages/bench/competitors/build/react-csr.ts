import { build } from "vite";
import react from "@vitejs/plugin-react";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { PROD_VITE_BUILD } from "./shared.ts";
import { syncCounterSource } from "./sources.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../react-csr");
await mkdir(join(root, "src"), { recursive: true });
await syncCounterSource("react", root);
await writeFile(
  join(root, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel</title></head><body><main id="app"></main><script type="module" src="/src/main.tsx"></script></body></html>`,
);
await writeFile(
  join(root, "src/main.tsx"),
  `import { createRoot } from "react-dom/client";
import { CounterApp } from "./App.tsx";
createRoot(document.getElementById("app")!).render(<CounterApp />);`,
);
await build({
  root,
  mode: "production",
  plugins: [react()],
  build: {
    ...PROD_VITE_BUILD,
    outDir: join(root, "dist"),
    rollupOptions: { ...PROD_VITE_BUILD.rollupOptions, input: join(root, "index.html") },
  },
});

console.log("built react-csr");
