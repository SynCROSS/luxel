# Bench perf priority and competitor peak fairness

**Status:** accepted

## Context

WinRK compares Luxel to framework SSR rows and `fastify-static` ceilings. Stakeholders want Luxel to pursue compiler-detected fast paths where they are valid production wins, while keeping framework comparisons honest: idiomatic peak implementations, shared inline HTTP harness, and competitors tuned to their own best-known patterns (SynCROSS / Platformatic reference class).

## Decision

1. **Luxel perf priority (two-step ladder)**
   - **Step A:** Compiler detects safe optimizations (e.g. constant-only `load`, compile-time precompute, ISR cache hit, static subtree freeze when added) and applies them on the production path. Valid when output contract unchanged.
   - **Step B:** When Step A cannot apply (dynamic `load`, spiral tier-2, `LUXEL_BENCH_FULL_RENDER=1`), Luxel must meet tier-2 geo-mean ≤ 1.08 vs {React, Vue, Solid, Svelte} on fair SSR rows.

2. **`fastify-static` is not a gate opponent** for framework geo-mean. It remains a labeled ceiling (zero render per request). Beating it on counter via precompute is a valid Step A win; beating it on spiral fair SSR is out of scope for comparison rows.

3. **Competitor rows must be idiomatic peak**
   - Counter: reactive state per framework (`useState`, `ref`, `createSignal`, `$state`, Luxel `signal`).
   - Spiral: per-request render, no client reactivity on tiles; shared tile math via `spiral-html.ts` / `sources/spiral/tiles.ts`.
   - Literal static `0` in counter markup without binding = **invalid row**.
   - CSR + SSR share one source file per stack (`competitorSource()`).

4. **Competitor harness parity (inline tier)**
   - Framework inline SSR rows and Luxel inline rows use **Bun.serve** via the same fetch-handler shape (`createFetchServer` / `createListenFetchServer` with `idleTimeout: 120`, `NODE_ENV=production`).
   - **Prod-stack rows** (Next RSC, SvelteKit, SolidStart) use framework deploy handlers (`node:http`); **included in tier-2 geo-mean gate** alongside inline and `*-worker-pool` rows.
   - `fastify-html` / `fastify-static` stay Fastify-labeled baselines (`role: baseline`); excluded from geo-mean.

5. **Competitor optimization obligation**
   - Each framework row must be tuned to that framework's fastest **realistic** production path (prod Vite build, correct SSR entry, `dev: false` compile, worker-pool rows when that tier is measured).
   - Reference implementations: [SynCROSS/ssr-performance-showdown](https://github.com/SynCROSS/ssr-performance-showdown). When a reference row is faster than our port, update the Luxel bench source to match — do not leave competitors artificially slow.

6. **Rejected**
   - Chasing `fastify-static` on spiral with pre-baked HTML in framework comparison rows.
   - Vite-free SvelteKit fork as default perf strategy (see ADR-0005 fallback criteria only after Step A + Step B + luxel-core SSR fail).

## Consequences

- `docs/benchmarks/fairness.md` and root `CONTEXT.md` **Performance claim ladder** reference this ADR.
- CI: `competitor-source-idiomatic.test.ts` guards counter/spiral source shape.
- Under-optimized competitor ports are bugs, not acceptable gate denominators.
