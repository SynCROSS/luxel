# WinRK stack build configs

Counter fixture DOM: `docs/benchmarks/fairness.md`. All CSR builds use Vite 6 production mode (`minify: esbuild`, `treeshake: smallest`).

| Stack | Versions | Build / serve | Key optimizations |
|-------|----------|---------------|-------------------|
| `react-csr` | React 19.1, Vite 6 | `build/react-csr.ts` → static dist | Fragment root (no wrapper div), prod minify |
| `react-ssr` | React 19.1 | Inline `renderToString` + Bun.serve | Fragment SSR, fresh render per request |
| `react-rsc` | Next 15.5 | `build/react-rsc.ts` | `dynamic = "force-dynamic"`, `compress: false`, telemetry off |
| `vue-vdom-csr` | Vue 3.5.16, @vitejs/plugin-vue 6 | `build/vue-vdom-csr.ts` | Standard vdom CSR prod bundle |
| `vue-vapor-csr` | Vue 3.6.0-beta.14, plugin-vue 6 | `build/vue-vapor-csr.ts` | `<script setup vapor>`, `vue-vapor` alias, `optionsAPI: false` |
| `solid-csr` | Solid 1.9, vite-plugin-solid | `build/solid-csr.ts` | esbuild jsx automatic, prod minify |
| `solidstart-ssr` | SolidStart 1.3, Vinxi 0.5 | `build/solidstart-ssr.ts` | Nitro node-server preset, prod minify, Document `<main>` shell |
| `svelte-csr` | Svelte 5.33, plugin-svelte 5 | `build/svelte-csr.ts` | `compilerOptions.dev: false` |
| `sveltekit-ssr` | SvelteKit 2.63, adapter-node 5 | `build/sveltekit-ssr.ts` | `prerender = false`, `ssr = true`, adapter-node |
| `sveltekit-isr` | SvelteKit 2.63 | same scaffold + `hooks.server.ts` | 1s in-memory HTML cache (parity with luxel-isr TTL) |
| `luxel-csr` | Luxel workspace | `examples/counter` SSG dist | Production `luxel build` static `/about` |
| `luxel-ssr` | Luxel workspace | `createTestServer()` | Precomputed HTML fast path + render worker (prod shape) |
| `luxel-isr` | Luxel workspace | nav-demo + 1s FsHtmlCache | ISR cache hit/miss under 1s revalidate |

## Luxel optimization level

**Level 1 (applied):** production compile/bundle, precomputed static-load HTML fast path in handler, no dev tooling in bench path.

**Level 2–4 not applied:** Luxel SSR is competitive on latency class but ships heavier documents (`luxel-data`, hydration scripts). Escalating to custom toolchain / syntax redesign would trade fairness-contract document weight for raw RPS — out of scope for apples-to-apples counter fixture.

Set `LUXEL_BENCH_FULL_RENDER=1` to force per-request `load` + render (strict SSR parity).

## fastify-html (luxel bench registry)

`Fastify({ logger: false, disableRequestLogging: true, connectionTimeout: 0, keepAliveTimeout: 72000 })` + `fastify-html` per-request templating.
