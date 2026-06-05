# Benchmark fairness contract

## Counter fixture (screen parity)

All SSR rows must render the same **visible** DOM:

- `<h1>Hello Luxel</h1>`
- `<section><button type="button" data-luxel-text="count">0</button></section>`

Defined in `packages/luxel/src/bench/fixtures/counter-contract.ts`.

## Per-request SSR

Framework rows (Luxel, React, Vue, Solid, Svelte, fastify-html) **must** run a fresh render on every HTTP request. Static pre-baked strings are **not** allowed in comparison rows (`static-http`, `fastify-static` are labeled baselines only).

## HTTP harness

- Framework SSR via `createListenFetchServer` → **Bun.serve** when available.
- **fastify-html** uses Fastify listen + `fetch` loop (same client pattern, different server impl — noted in results).

## Document weight

- **`ssr_html_bytes`** published per row. Luxel includes `luxel-data`, `luxel-hydration`, and client `<script>` — larger than minimal competitor shells. Interpret rps together with bytes; transfer tier is separate gate.
- Competitors use a minimal shared document shell (`<main>` + contract body). Luxel uses production document shape.

## Rows

| `framework` | Role |
|-------------|------|
| `luxel` | Production pipeline; static `load` may use compile-time precompute + handler fast path (valid prod win). Set `LUXEL_BENCH_FULL_RENDER=1` to force per-request `load` + render for strict SSR parity. |
| `fastify-html` | Platformatic-style templating baseline, per-request |
| `fastify-static` | Static string ceiling (not in geo-mean gate) |
| `static-http` | Fixed Response body (not in geo-mean gate) |
| `react`, `vue-vdom`, `solid`, `svelte` | Per-request `renderToString` / equivalent (TypeScript ecosystem comparison set) |
| `vue-vapor` | Pending until Vue 3.6 vapor bench pipeline wired |

## Gate denominators

Geo-mean factors use only frameworks with non-`pending` results in the same CI run (see `CONTEXT.md` **v1.0 performance exit**).
