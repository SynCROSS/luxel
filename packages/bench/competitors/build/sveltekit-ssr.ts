import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runSvelteKitViteBuild } from "./svelte-vite-build.ts";
import { BENCH_SERVER_MJS, SVELTEKIT_POOL_BOOTSTRAP, kitPackageJson } from "./shared.ts";
import { competitorSource } from "@luxel/luxel/bench";

async function scaffoldSvelteKit(app: "sveltekit-ssr" | "sveltekit-isr", isr: boolean) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", app);
  await mkdir(join(root, "src/routes"), { recursive: true });
  await writeFile(join(root, "package.json"), kitPackageJson(app));
  await writeFile(
    join(root, "svelte.config.js"),
    `import adapter from "@sveltejs/adapter-node";
/** @type {import("@sveltejs/kit").Config} */
const config = {
  kit: {
    adapter: adapter({ precompress: false }),
    inlineStyleThreshold: Infinity,
  },
  compilerOptions: { dev: false },
};
export default config;`,
  );
  await writeFile(
    join(root, "vite.config.ts"),
    `import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [sveltekit()],
  build: { minify: "esbuild", sourcemap: false, cssMinify: true },
});`,
  );
  await writeFile(
    join(root, "src/app.html"),
    `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Luxel</title>%sveltekit.head%</head><body><main>%sveltekit.body%</main></body></html>`,
  );
  await writeFile(
    join(root, "src/routes/+layout.ts"),
    `export const prerender = false;
export const ssr = true;`,
  );
  await copyFile(competitorSource("counter", "svelte.svelte"), join(root, "src/routes/+page.svelte"));
  if (isr) {
    await writeFile(
      join(root, "src/hooks.server.ts"),
      `const cache = new Map<string, { body: string; at: number }>();
export async function handle({ event, resolve }) {
  const key = event.url.pathname;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < 1000) {
    return new Response(hit.body, { headers: { "content-type": "text/html; charset=utf-8", "x-cache": "hit" } });
  }
  const response = await resolve(event);
  const body = await response.text();
  cache.set(key, { body, at: now });
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "x-cache": "miss" } });
}`,
    );
  }
  await writeFile(join(root, ".bench-server.mjs"), BENCH_SERVER_MJS);
  await writeFile(join(root, ".bench-pool-bootstrap.mjs"), SVELTEKIT_POOL_BOOTSTRAP);

  await runSvelteKitViteBuild(root, app);
}

await scaffoldSvelteKit("sveltekit-ssr", false);
await scaffoldSvelteKit("sveltekit-isr", true);
