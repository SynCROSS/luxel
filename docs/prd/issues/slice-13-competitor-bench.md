## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

**Benchmark scorecard (C4g):** full architecture §11 competitor matrix on shared fixtures — Luxel, React, Vue/Vapor, Solid, Svelte, Fastify (where applicable). Micro + app-class (docs-site). Publish per-metric results; document scorecard weights.

## Acceptance criteria

- [ ] Runners exist for each framework in matrix on counter-class micro fixture
- [ ] App-class fixture includes docs-site (or agreed app fixture)
- [ ] `luxel bench` or bench package driver produces comparable JSON lines per framework
- [ ] Results published in repo (e.g. `docs/benchmarks/` or CI artifact) with date and toolchain versions
- [ ] Weighted scorecard formula documented
- [ ] CI runs Luxel + at least one competitor on micro fixture (full matrix may be nightly)

## Blocked by

- https://github.com/SynCROSS/luxel/issues/37
- https://github.com/SynCROSS/luxel/issues/46
