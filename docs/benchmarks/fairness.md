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

- **Inline framework + Luxel rows (locked):** same runtime and server shape — **Bun.serve** fetch handler, `NODE_ENV=production`, `idleTimeout: 120` (see ADR-0006). WinRK uses `createFetchServer`; Luxel test/bench servers use `createListenFetchServer` (equivalent Bun.serve path).
- **Labeled baselines:** `fastify-html` and `fastify-static` use Fastify listen — noted in results; excluded from framework geo-mean.
- **Prod-stack rows** (Next RSC, SvelteKit, SolidStart): framework deploy handler + internal `node:http` — separate deployment tier; not the inline harness reference.

## Competitor peak tuning

Each framework row must reflect that framework's **fastest realistic** production SSR path, not a deliberately slow stub:

- Production Vite/build flags (`minify`, `treeshake`, `dev: false` compiler options).
- Correct SSR entry (`renderToString`, Solid `ssr`/`renderToString`, Svelte `render` from `svelte/server`, Vue Vapor `vue-vapor/server-renderer`).
- Port [SynCROSS/ssr-performance-showdown](https://github.com/SynCROSS/ssr-performance-showdown) patterns when faster than current Luxel bench sources — update `packages/luxel/src/bench/competitors/sources/`.
- **Invalid:** counter without reactive binding (e.g. literal `0` in template); spiral with client signals/refs on tiles; duplicate inline markup diverging from shared source files.

CI guard: `packages/luxel/test/competitor-source-idiomatic.test.ts`.

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

**Tier-2 WinRK geo-mean (locked):** flat across every `role: framework` row with `status: ok` in the fixture — **inline**, **prod-stack** (Next RSC, SvelteKit, SolidStart), and **`*-worker-pool`** rows all count. Excluded: `role: baseline` (`static-http`, `fastify-static`), `pending`, `error`. **`luxel-ssr-native` and `luxel-spiral-ssr-native` always count** when `status: ok` — even after native merges into default `luxel-ssr` / `luxel-spiral-ssr`; lab row stays in gate denominator to prevent native regression. **Native merge (locked):** default `luxel-ssr` / `luxel-spiral-ssr` adopt native body when `luxel-ssr-native` ≥ `luxel-ssr-full` (per-request parity bar); merged row keeps **precompute fast path** when legal **and** native body when manifest `ssr: "native"` + loadable addon. Per Luxel row: `factor = rps_fastest_competitor / rps_luxel_row` where `rps_fastest_competitor` = max RPS among ok non-Luxel framework rows in that fixture. **Pass:** geometric mean of Luxel row factors ≤ **1.08**. Implementation: `packages/bench/src/winrk/winrk-geo-gate.ts`.

**`luxel bench --gate`:** separate micro-harness JSON lines; same 1.08 threshold; framework family denominators {Luxel, React, Vue, Solid, Svelte} per fixture cell.

Geo-mean factors use only frameworks with non-`pending` results in the same CI run (see `CONTEXT.md` **v1.0 performance exit**).
