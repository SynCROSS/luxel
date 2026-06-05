## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

**v1.1 toolchain parity (ADR-0003 phase A):** `luxel dev`, `luxel build`, `luxel bench`, and framework unit tests runnable on **Node** and **Deno** hosts — not only Bun. v1.0 remains Bun-only toolchain; this slice completes ADR phase A.

**Compile backend (locked):** **esbuild** for v1.1-rc bundling + Luxel-owned SFC compiler; WASM core swap later. **Rejected:** `luxel-host.mjs` Bun-spawn bridge — entries are `luxel-node` / `luxel-deno` only.

## Acceptance criteria

- [x] Documented commands work on Node 20+ and Deno 2+ with parity to Bun for counter or minimal fixture
- [x] CI matrix includes Node and Deno toolchain jobs for build + test
- [x] `docs/deploy-matrix.md` updated: toolchain parity row green for v1.1
- [ ] No regression to Node/Deno **deploy-only** path from phase B

## Blocked by

- https://github.com/SynCROSS/luxel/issues/47
