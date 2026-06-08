# Benchmark fairness contract

## Counter fixture (screen parity)

All SSR rows must render the same **visible** DOM:

- `<h1>Hello Luxel</h1>`
- `<section><button type="button" data-luxel-text="count">0</button></section>`

Defined in `packages/luxel/src/bench/fixtures/counter-contract.ts`.

## Idiomatic peak (source shape)

**Output** locked above. **Source** must be framework-native reactive code at peak idiomatic perf — CSR **and** SSR:

| Framework | Counter pattern (example) |
|-----------|---------------------------|
| Luxel | `signal(0)` + template binding |
| React | `useState(0)` + JSX |
| Vue vdom / Vapor | `ref(0)` + template; Vapor uses shared `App.vue` (`<script setup vapor>`), CSR `createVaporApp`, SSR same SFC + `renderToString`. **Spiral:** port SynCROSS `vue/client/base.vue` → vapor `App.vue` (SynCROSS has vdom only; vapor row = same tile logic + vapor compile) |
| Solid | `createSignal(0)` + JSX or `ssr` with signal |
| Svelte 5 | `$state(0)` or runes + `{count}` binding |

Literal `0` in markup without reactive binding = **invalid row**. Each stack tuned for that framework’s fastest production path (minify, tree-shake, correct compiler mode).

**Shared component per counter stack (locked):** CSR build and SSR server import the **same** component file (`App.tsx`, `App.vue`, `App.svelte`, etc.) — no duplicate inline markup in `inline-ssr.ts` / `runners.ts`. Luxel uses `examples/counter`.

## Spiral fixture (tier 2)

~2398 positioned `div.tile` elements in `#wrapper` (Platformatic / [SynCROSS](https://github.com/SynCROSS/ssr-performance-showdown) spiral — `cellSize = 10` step). Shared tile math: `spiral-html.ts`. Reference: [Platformatic SSR performance showdown](https://blog.platformatic.dev/ssr-performance-showdown). **Implementation reference repo:** [SynCROSS/ssr-performance-showdown](https://github.com/SynCROSS/ssr-performance-showdown/tree/main) — adapt per-framework spiral examples from there; shared spiral component per framework under `packages/luxel/src/bench/competitors/`.

**Consistency rules (from Platformatic, locked for Luxel spiral rows):**

- Per-request framework SSR (`renderToString` / Svelte `render` / Solid `renderToString` + component) — not static pre-baked HTML strings in comparison rows.
- **No client-side reactivity** on spiral — no `ref`, `$state`, `createSignal`, `useState` for tiles; compute tile positions per request, render via framework engine.
- Style bindings via template literals / framework-native static bindings (`left: …px; top: …px`); `toFixed(2)` on coordinates.
- Production build; document shell only outside the spiral body.

Counter idiomatic-peak (reactive state) **does not** apply to spiral. Baselines: `static-http`, `fastify-static` (labeled, excluded from geo-mean).

## Per-request SSR

Framework rows (Luxel, React, Vue, Solid, Svelte, fastify-html) **must** run a fresh render on every HTTP request. Static pre-baked strings are **not** allowed in comparison rows (`static-http`, `fastify-static` are labeled baselines only).

## HTTP harness

- Framework SSR via `createListenFetchServer` → **Bun.serve** when available.
- **fastify-html** uses Fastify listen + `fetch` loop (same client pattern, different server impl — noted in results).

## Document weight

- **`ssr_html_bytes`** published per row. Luxel **default document shape** includes sidecars + client script only when the route has client consumers (hydration boundaries, nav, attach bind points). Zero-client routes (e.g. spiral) ship minimal HTML — parity with competitor shells. Counter/interactive routes retain full prod shape.
- Competitors use a minimal shared document shell (`<main>` + contract body). Luxel matches that weight class on zero-client routes; heavier docs on interactive routes are expected and tracked separately on transfer tier.

## Rows

| `framework` | Role |
|-------------|------|
| `luxel` | Production pipeline; static `load` may use compile-time precompute + handler fast path (valid prod win). Set `LUXEL_BENCH_FULL_RENDER=1` to force per-request `load` + render for strict SSR parity. |
| `fastify-html` | Platformatic-style templating baseline, per-request |
| `fastify-static` | Static string ceiling (not in geo-mean gate) |
| `static-http` | Fixed Response body (not in geo-mean gate) |
| `react`, `solid`, `svelte` | Per-request `renderToString` / equivalent (TypeScript ecosystem comparison set) |
| `vue-vdom` | Vue 3.5 virtual DOM CSR + inline `renderToString` SSR |
| `vue-vapor` | Vue 3.6 beta Vapor mode (`createVaporApp`, `vapor` SFC compile) |

## Gate denominators

Geo-mean factors use only frameworks with non-`pending` results in the same CI run (see `CONTEXT.md` **v1.0 performance exit**).
