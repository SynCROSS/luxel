# Benchmarks

Luxel micro-benchmarks and future competitor scorecard fixtures.

## Horizon C2 skeleton

- **Registry:** `fixtures/micro/{counter,list,table}` — counter runnable; list/table reserved (`pending`).
- **CLI:** `luxel bench` emits JSON lines: `{ "fixture", "metric", "value" }`.
- **Metrics (counter):** SSR throughput (req/s), client JS bytes.
- **Deferred until v1.0 (C4g):** competitor runners for React, Vue/Vapor, Solid, Svelte, Fastify; weighted scorecard; app fixtures (blog/dashboard/ecommerce/auth); server-stress fixtures; Web Vitals in CI. **v1.0 exit:** full §11 matrix per root `CONTEXT.md` **Benchmark scorecard (C4g)**.
