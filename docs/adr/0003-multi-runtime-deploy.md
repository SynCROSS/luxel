# Multi-runtime deploy (phase B)

**Status:** accepted

Luxel is **Vite-free** and today centers on **Bun** for `luxel build`, `luxel dev`, bundling (`Bun.build`), and local servers (`Bun.serve`). Production deploy should not require Bun on the host. This ADR locks **phase B** (pre-v1): run the app server on **Node** and **Deno** while the **toolchain stays Bun-only** until **v1 phase A** (full parity: dev, build, bench, tests on all three runtimes).

## Decision

1. **Phasing:** **Phase B (pre-v1):** production server on Node 20+ and Deno 2+; `luxel build` / `luxel dev` / `luxel bench` / framework unit tests remain **Bun-only**. **Phase A (v1):** toolchain parity on Bun, Node, and Deno.

2. **HTTP contract:** Deploy surface is Web **`fetch`** — `createAppServerFetch({ app, clientBundle, … })`. No second app model per runtime.

3. **Adapters:** **Handler-first**; **thin listen glue** only:
   - `serveLuxel({ distDir, port, hostname?, compress? })` (name may vary) loads dist, builds fetch, binds HTTP.
   - Shipped as **`@luxel/luxel` subpath exports** (`@luxel/luxel/node`, `@luxel/luxel/deno`, plus a deploy subpath for `loadAppFromDist` and server exports).
   - Separate `@luxel/node` / `@luxel/deno` packages deferred unless adapters outgrow one package at v1.

4. **Artifacts:** One shared **`dist/`** (ESM). **`luxel build` (Bun)** emits a **bundled** `dist/server/app.mjs` with resolved dependencies, plus existing manifest, client assets, and `dist/server/entry.js` compress wiring. Raw `dist/server/routes/*.ts` remain **inspectable/debug emit**, not the Node/Deno entry path.

5. **Loading:** Framework exposes **`loadAppFromDist(distDir)`** → `{ app, clientBundle }` for `createAppServerFetch` and adapters.

6. **Module system:** **ESM-only** pre-v1; no CJS dual emit until v1 pressure.

7. **Node floor:** **Node 20+** LTS. **zstd** on Node only when `node:zlib` exposes `zstdCompressSync` (**Node ≥22.15**); older 20.x / 22.14 skip zstd in negotiation and pick the next mutual codec (br → gzip → deflate). Document in deploy matrix.

8. **Compression encoders (phase B):** Single encoder module, runtime-selected:
   - **Bun:** `Bun.*Sync` (incl. zstd).
   - **Node / Deno deploy:** `node:zlib` for gzip, deflate, br, and zstd when `zstdCompressSync` exists.
   - If a negotiated codec has no encoder, **skip it** — never throw mid-request.
   - **No npm codec dependency** in phase B. Optional npm backends remain the ADR-0002 follow-up for exotic overrides.

9. **Edge / workers:** Cloudflare Workers, Vercel Edge, etc. stay **out of phase B**; prioritize Node + Deno long-running servers first (see architecture open items).

## Considered options

| Topic | Rejected | Why |
|-------|----------|-----|
| v1 scope day one | Full toolchain parity on Bun, Node, Deno (A) | Deepest lock-in is `Bun.build`; ship deploy first (B). |
| Deploy only | CLI stays Bun forever | User goal is v1 parity; Bun-only toolchain is explicit pre-v1 bound (B now, A at v1). |
| Integration | Generated `start.mjs` per runtime (3) or fat single binary (4) | Premature before bundled `app.mjs` + loader proven; adapters on handler suffice (2 on 1). |
| Dist loading | Dynamic-import raw `dist/server/routes/*.ts` (A) | Emits monorepo-relative paths today; not runnable on Node (D: bundle + `loadAppFromDist`). |
| Author-only bootstrap | App-owned `server.ts` wiring only (C) | Valid escape hatch; poor default DX vs adapters. |
| Deno emit | Separate Deno `dist/` | One ESM tree; Deno 2 imports npm/specifiers (shared dist). |
| zstd on Node | npm zstd always (B) or disable compress on Node (D) | `node:zlib` zstd from 22.15; Node 20+ floor with capability skip (1). |
| Node floor | Bump to 22.15+ for guaranteed zstd (2) | Broader LTS; honest matrix beats forced floor bump. |
| Encoders | `CompressionStream`-only on Node (C) | Uneven vs sync zlib path already used for br. |
| Packaging | `@luxel/node`, `@luxel/deno` packages (2) | Phase B glue is tiny; subpaths keep one version line (1). |
| ADR timing | CONTEXT-only until impl | Decisions are stable; ADR prevents re-litigation (yes). |

## Consequences

### Implementation slice (phase B)

Ship in this order:

1. **Encoders** — runtime-selected compression in `compress.ts` (Bun vs `node:zlib`; capability-gated zstd).
2. **Bundle + loader** — `luxel build` emits `dist/server/app.mjs`; **`loadAppFromDist(distDir)`**.
3. **Adapters** — `@luxel/luxel/node`, `@luxel/luxel/deno`, deploy subpath; `serveLuxel({ distDir, … })`.
4. **Integration test** — Node spawns adapter against built counter or nav-demo `dist/`.

Also: **deploy matrix** doc table (runtime × toolchain × zstd availability).

### Deferred

- v1 toolchain parity (dev/build/bench on Node and Deno).
- Edge adapters (after Bun/Node/Deno server path).
- npm compression fallbacks ([ADR-0002](./0002-response-compression.md) follow-up).
- Separate `@luxel/node` / `@luxel/deno` packages unless subpaths become inadequate.

### Ongoing

- Domain glossary: root `CONTEXT.md` (`Runtime support policy`, `Deploy integration`, `Deploy artifact loading`, `Node deploy floor`, `Runtime adapter packaging`, `Compression implementation policy`).
- `docs/architecture.md` §1 Runtime row reflects phase B vs v1.
- [ADR-0002](./0002-response-compression.md) encoder work must align with §8 above on Node/Deno deploy.

## Related

- Root `CONTEXT.md` — runtime and deploy glossary entries
- `docs/architecture.md` — compact goals and roadmap
- `packages/luxel/src/server/handler.ts` — `createAppServerFetch`
- `packages/luxel/src/build/build-app.ts` — production `dist/server/entry.js`
- [ADR-0002](./0002-response-compression.md) — compression middleware and codec policy
