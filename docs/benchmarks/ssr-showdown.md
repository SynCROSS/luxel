# SSR throughput (Platformatic-style)

Reference: [An SSR Performance Showdown](https://blog.platformatic.dev/ssr-performance-showdown) (Platformatic, 2024).

## Workload

- **Document:** large CPU-bound page — spiral of ~2.4k positioned `div` tiles (10×10px tiles, SynCROSS `cellSize = 10` step; see `spiral-html.ts`).
- **Per request:** full SSR (or ISR miss / SSG miss / SW document miss) — no cached HTML string shortcut for framework competitors.
- **Build:** production `luxel build` (Luxel); production Vite build for Vite-based competitors in the comparison run.
- **HTTP:** shared listen harness (Fastify or Luxel `createAppFetch` + adapter); measure **requests per second** over sustained iterations.

## Modes (Luxel v1.0 matrix)

| Mode | How exercised |
|------|----------------|
| SSR | Dynamic route; render worker every request |
| ISR | `revalidate` route; cold or expired cache → regen via worker |
| SSG | `prerender` route; serve from `dist/static/` when fresh |
| Trisomorphic | SW `fetch` path on nav-demo — document from cache or network SSR fallback |

## Competitors (tier 2)

React, Vue, Svelte, Solid (+ Luxel). Same spiral component port per framework. Preact optional in published table, not required for v1.0 gate.

## Pass bar

Per cell: `factor = rps_fastest / rps_luxel`. **v1.0 exit:** geometric mean of all cell factors ≤ **1.08**. Publish median factor and per-cell JSON lines.

## Implementation status

- Counter micro bench: wired.
- Spiral fixture: wired — Luxel + React, Vue vdom/vapor, Solid, Svelte, fastify-html, static-http, fastify-static (`luxel bench` emits `ssr_throughput_rps` + `render_worker_throughput_rps` for Luxel).
- ISR/SSG/SW throughput rows: **pending**.

Run: `luxel bench` or WinRK (`WINRK_FIXTURE=spiral bun run --cwd packages/bench bench:winrk`).
