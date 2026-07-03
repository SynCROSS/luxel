/** Per-stack optimization notes — embedded in JSON results + documented in docs/benchmarks/stacks.md */
const RENDER_WORKER_POOL_NOTE =
  "Render worker pool: SynCROSS round-robin dispatch; counter rows WinRK-tuned default 1 worker (JIT warmup once per worker, ack-only hot path with parent pooledHtml); spiral uses hardwareConcurrency; override BENCH_RENDER_WORKER_COUNT (Bun Worker on Unix; node:worker_threads on Windows — BENCH_RENDER_WORKER_BACKEND)";

export const STACK_OPTIMIZATIONS: Record<string, string[]> = {
  "static-http": [
    "Bun.serve precomputed Response body — zero render per request",
    "Fixed HTML buffer reused across requests",
  ],
  "fastify-static": [
    "Fastify logger + request logging disabled",
    "keepAliveTimeout 72s, connectionTimeout 0",
    "Prebuilt HTML via reply.send — no templating",
  ],
  "fastify-html": [
    "Fastify production opts (no logger, no request id)",
    "fastify-html per-request templating with shared layout",
    "keepAliveTimeout 72s for connection reuse",
  ],
  "fastify-html-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "fastify-html counter markup per worker job",
  ],
  "react-csr": [
    "Vite production build: esbuild minify, treeshake smallest",
    "Fragment root — no wrapper div",
    "target es2022",
  ],
  "react-ssr": [
    "renderToString per request with module cache warmup",
    "Bun.serve fetch handler — low overhead HTTP",
    "250-req JIT warmup before measurement",
  ],
  "react-ssr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "One renderToString warmup per worker; ack-only IPC with parent pooledHtml (framework-micro)",
  ],
  "vue-vdom-ssr": [
    "Vue renderToString per request via Bun.serve",
    "Shared App.vue compile cache + 250-req JIT warmup",
    "Vite prod minify + treeshake for component module",
  ],
  "vue-vdom-ssr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "Vue renderToString per worker job",
  ],
  "vue-vapor-ssr": [
    "Vue Vapor server-renderer per request via Bun.serve",
    "Vapor SFC compile via vue-vapor/compiler-sfc",
    "Module cache + startup render warmup",
  ],
  "vue-vapor-ssr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "Vue Vapor server-renderer per worker job (vue-vapor/compiler-sfc)",
  ],
  "solid-ssr": [
    "solid-js/web renderToString per request via Bun.serve",
    "Shared CounterApp import, module cache warmup",
    "esbuild jsx automatic, prod NODE_ENV",
  ],
  "solid-ssr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "solid-js/web renderToString per worker job",
  ],
  "svelte-ssr": [
    "Svelte 5 SSR render per request via Bun.serve",
    "compilerOptions.dev: false",
    "Shared App.svelte compile cache at module load",
  ],
  "svelte-ssr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "Svelte 5 SSR render per worker job",
    "Parent pooledHtml ack-only IPC on spiral pool",
  ],
  "react-rsc": [
    "Next.js production build; Bun in-process HTTP (same runtime as other prod-stack rows)",
    "compress/etag off, strict mode off, optimizePackageImports",
    "Server Component shell + client island (CounterButton)",
    "force-static — build-time prerender (counter initial state is fixed)",
    "Module-level prepare + cached parse('/') hot path",
  ],
  "react-rsc-worker-pool": [
    "Shared Next HTTP server (Next handler incompatible with worker_threads capture)",
  ],
  "solidstart-ssr-worker-pool": [
    "Vinxi Nitro node-server — shared HTTP server (Nitro init hangs in worker_threads)",
  ],
  "solidstart-ssr": [
    "Vinxi node-server preset, production NODE_ENV",
    "esbuild minify, target es2022",
    "Minimal Document shell with <main>",
  ],
  "sveltekit-ssr": [
    "adapter-node precompress: false",
    "inlineStyleThreshold: Infinity — inline CSS",
    "ssr=true, prerender=false — per-request render",
    "Vite minify esbuild, no sourcemaps",
  ],
  "sveltekit-ssr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "SvelteKit Server.respond per worker thread",
  ],
  "sveltekit-isr": [
    "Same as sveltekit-ssr + 1s in-memory HTML cache",
    "ISR miss+hit warmup before measurement",
  ],
  "sveltekit-isr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "Shared 1s ISR cache in parent + SvelteKit Server.respond per worker",
  ],
  "vue-vdom-csr": [
    "Vite prod: minify, treeshake smallest, no sourcemaps",
    "Shared App.vue for CSR + SSR parity",
  ],
  "vue-vapor-csr": [
    "Vue 3.6 Vapor compile mode",
    "optionsAPI: false, createVaporApp CSR mount",
    "Vite prod minify + treeshake",
  ],
  "solid-csr": [
    "vite-plugin-solid production, esbuild jsx automatic",
    "Vite treeshake smallest preset",
  ],
  "svelte-csr": [
    "Svelte 5 compilerOptions.dev: false",
    "Vite prod minify + cssMinify",
  ],
  "luxel-csr": [
    "Production luxel build SSG dist (counter index prerender)",
    "Bun.serve static file handler — prebuilt HTML + assets",
  ],
  "luxel-ssr": [
    "Production compile + precomputed static-load fast path",
    "Auto native body when @luxel/core-node loadable (merged Q6)",
    "Full counter hydration (sidecars + client bundle)",
  ],
  "luxel-ssr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "compileCounterApp + renderWorker per worker thread",
  ],
  "luxel-ssr-full": [
    "Per-request load + render — precompute disabled at compile (dynamic render module)",
    "Strict SSR parity with inline competitor rows",
    "Full counter hydration (sidecars + client bundle)",
  ],
  "luxel-ssr-native": [
    "luxel-core counter hot path: renderCounterBody(message) — no JSON IR on nativeKind=counter",
    "Per-request load + render (benchNativeLab — no compile precompute)",
  ],
  "luxel-ssr-full-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "Per-request load + render in worker (precompute stripped)",
  ],
  "luxel-isr": [
    "FsHtmlCache with 1s revalidate TTL",
    "ISR miss+hit warmup before measurement",
    "nav-demo fixture — full prod document shape",
  ],
  "luxel-isr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "Shared 1s ISR cache in parent + nav-demo renderWorker per worker",
  ],
  "static-http-spiral": [
    "Bun.serve precomputed spiral HTML body",
    "Zero per-request tile computation",
  ],
  "fastify-static-spiral": [
    "Prebuilt spiral markup via reply.send",
    "Fastify keep-alive + logging disabled",
  ],
  "fastify-html-spiral": [
    "Per-request spiralBodyMarkup via fastify-html",
    "Shared layout with inlined tile CSS",
  ],
  "luxel-spiral-ssr": [
    "Auto native body when @luxel/core-node loadable (merged Q6)",
    "Per-request tile load + {#each} — no precompute (fairness.md)",
    "Slim fetch pipeline + minimal document shell",
  ],
  "luxel-spiral-ssr-full": [
    "TS SSR + benchFullRender strips any compile precompute",
    "Slim fetch pipeline; per-request load + {#each} render",
  ],
  "luxel-spiral-ssr-native": [
    "luxel-core renderSpiralBody() — Rust compute+render, no tile marshalling",
    "Per-request load (fairness.md); slim fetch pipeline",
  ],
  "react-spiral-ssr": [
    "Per-request renderToString with shared spiral component",
    "Module cache + startup render warmup",
  ],
  "vue-vdom-spiral-ssr": [
    "Vue renderToString per request",
    "SFC compile cache at module load",
  ],
  "vue-vapor-spiral-ssr": [
    "Vue Vapor server-renderer per request",
    "Vapor SFC compile mode",
  ],
  "solid-spiral-ssr": [
    "solid-js/web renderToString per request",
    "Shared spiral component import",
  ],
  "svelte-spiral-ssr": [
    "Svelte 5 SSR render per request",
    "compilerOptions.dev: false",
  ],
  "react-spiral-ssr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "Per-request renderToString in worker thread",
    "Parent pooledHtml ack-only IPC (no ~138KB HTML over worker channel)",
  ],
  "vue-vdom-spiral-ssr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "Vue renderToString per worker job",
    "Parent pooledHtml ack-only IPC",
  ],
  "vue-vapor-spiral-ssr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "Vue Vapor server-renderer per worker job (vue-vapor/compiler-sfc)",
    "Parent pooledHtml ack-only IPC",
  ],
  "solid-spiral-ssr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "solid-js/web renderToString per worker job",
    "Parent precompiled solid artifact + pooledHtml ack-only IPC",
  ],
  "svelte-spiral-ssr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "Svelte 5 SSR render per worker job (dev: false)",
    "Parent pooledHtml ack-only IPC",
  ],
  "fastify-html-spiral-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "fastify-html spiral markup per worker job",
  ],
  "luxel-spiral-ssr-worker-pool": [
    RENDER_WORKER_POOL_NOTE,
    "Worker hot path: renderSpiralBody() NAPI only; parent pooledHtml; Fastify HTTP",
  ],
};

export function optimizationsForStack(id: string): string[] {
  return STACK_OPTIMIZATIONS[id] ?? [];
}
