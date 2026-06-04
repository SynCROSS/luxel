# PRD: Phase B multi-runtime deploy (Node + Deno)

## Problem Statement

Luxel is Vite-free and centers on Bun for build, dev, and local serve. Teams deploying to standard Node LTS or Deno hosts cannot run production without Bun on the server. That coupling blocks common deploy targets (Docker Node images, PaaS Node runtimes, Deno Deploy-style hosts) and conflicts with the goal of a portable HTTP surface. Authors need production SSR + assets + optional response compression on Node and Deno while keeping the authoring toolchain on Bun until v1.

## Solution

Deliver **phase B** (pre-v1): production app server on **Node 20+** and **Deno 2+** via Web `fetch` (`createAppServerFetch`), a bundled deploy artifact (`dist/server/app.mjs`), `loadAppFromDist`, runtime-aware compression encoders, and thin listen adapters as `@luxel/luxel` subpaths. **luxel build**, **luxel dev**, **luxel bench**, and framework unit tests remain Bun-only until v1 phase A (full toolchain parity). One shared ESM `dist/`; no second app model per runtime.

## User Stories

1. As a platform engineer, I want to deploy Luxel apps on Node 20+ without installing Bun on the server, so that I can use our existing Node container and ops playbooks.
2. As a platform engineer, I want to deploy Luxel apps on Deno 2+, so that I can host on Deno-native infrastructure.
3. As an app author, I want `luxel build` (run on Bun in CI) to emit artifacts Node/Deno can run, so that build and deploy runtimes can differ.
4. As an app author, I want a single `dist/` layout (ESM), so that I do not maintain separate Node and Deno build outputs pre-v1.
5. As an app author, I want `loadAppFromDist(distDir)` to return everything needed for `createAppServerFetch`, so that I can integrate with custom HTTP servers if needed.
6. As an app author, I want `@luxel/luxel/node` to expose `serveLuxel({ distDir, port, … })`, so that I can start production with minimal boilerplate.
7. As an app author, I want `@luxel/luxel/deno` to expose the same listen helper, so that Deno deploy matches Node ergonomics.
8. As an app author, I want production compression to work on Node/Deno deploy, so that wire size matches Bun deploy behavior where codecs are available.
9. As an app author on Node 22.15+, I want zstd negotiation when the client offers it, so that modern browsers get optimal compression.
10. As an app author on Node 20–22.14, I want zstd skipped automatically with br/gzip/deflate still negotiated, so that deploy does not crash on missing zstd APIs.
11. As an app author, I want streamed SSR (`?stream=1`) to remain identity-encoded per streaming compression policy, so that streaming behavior stays predictable.
12. As an app author, I want `dist/server/entry.js` to keep wiring `productionCompress` from config, so that production defaults stay declarative.
13. As an app author, I want raw `dist/server/routes/*` to remain inspectable for debugging, so that I can diff generated route modules without using them as the deploy entry.
14. As a maintainer, I want compression encoding isolated behind a small encoder interface, so that Bun vs Node/Deno selection does not sprawl through middleware.
15. As a maintainer, I want encoder capability probes (e.g. zstd available), so that negotiation never throws for unsupported codecs.
16. As a maintainer, I want the server bundle step to resolve monorepo-relative imports in generated routes, so that Node does not import compiler source trees at runtime.
17. As a maintainer, I want phase B shipped in order encoders → bundle/loader → adapters → Node integration test, so that each slice is testable before the next.
18. As a maintainer, I want a Node integration test that builds an example app and hits `/` via the Node adapter, so that regressions in deploy path are caught in CI (Bun test runner spawning Node is acceptable).
19. As a maintainer, I want a deploy matrix table in docs, so that runtime × toolchain × zstd availability is explicit.
20. As a security-conscious author, I want deploy to use the same `createAppServerFetch` contract (no executable sidecars), so that threat model for SSR responses is unchanged.
21. As an app author using resource store / nav-demo patterns, I want Node deploy to serve HTML with `luxel-data` sidecars, so that post-prototype client nav fixtures remain valid on Node hosts.
22. As an app author, I want internal revalidate routes to remain test-only (not enabled in default production adapter), so that production surface stays minimal.
23. As a contributor, I want package.json exports for `/node`, `/deno`, and deploy subpath documented, so that import paths are stable.
24. As an app author, I want Deno adapter to load the same `dist/` as Node, so that I do not learn two deploy layouts.
25. As a future v1 author, I want phase B decisions documented in ADR-0003, so that v1 toolchain parity work does not relitigate deploy shape.

## Implementation Decisions

### Phasing and contract

- **Phase B (this PRD):** production server on Node 20+ and Deno 2+; toolchain Bun-only.
- **Phase A (v1, out of scope):** `luxel dev` / `build` / `bench` / framework tests on Bun, Node, Deno.
- **HTTP contract:** `createAppServerFetch({ app, clientBundle, compress?, internalRoutes? })` unchanged; adapters call it after `loadAppFromDist`.
- **ADR-0003** is authoritative for rejected alternatives.

### Module 1: Compression encoders (deep module)

- Extract runtime-selected encode from middleware.
- **Bun path:** existing `Bun.gzipSync`, `Bun.deflateSync`, `Bun.zstdCompressSync`.
- **Node/Deno deploy path:** `node:zlib` for gzip, deflate, br; zstd only when `zstdCompressSync` exists.
- **Capability API:** e.g. `getAvailableEncodings(preferred: CompressionFormat[]): CompressionFormat[]` or encode-time skip — negotiated codec must not throw if encoder missing.
- **Middleware** (`wrapCompress`) calls encoder module only; no direct `Bun.*` in middleware after refactor.
- Align with **Compression implementation policy** and ADR-0002; no npm codec deps in phase B.

### Module 2: Server bundle (build pipeline)

- Extend **luxel build** (Bun-only) to emit **`dist/server/app.mjs`** via Bun.build: entry aggregates routes + runtime deps with resolved paths (no imports into monorepo compiler trees).
- Keep existing outputs: manifest, client asset, `dist/server/entry.js` compress stub, inspectable `dist/server/routes/*` debug emit.
- **CompiledApp** in-memory shape at build time remains source of truth; bundle exports a factory compatible with `createAppServerFetch` expectations.

### Module 3: `loadAppFromDist` (deploy loader)

- **Input:** `distDir` (absolute or cwd-relative).
- **Output:** `{ app, clientBundle }` matching `AppServerOptions` needs (types aligned with `CompiledApp` runtime surface).
- **Implementation:** dynamic import of `dist/server/app.mjs` (or documented export name); read client bundle bytes from `dist/assets/*` per manifest / existing asset constant.
- **Errors:** clear failures for missing bundle, corrupt manifest, version mismatch (if envelope versioning added later, defer strict version gate unless already required).

### Module 4: Node adapter (`@luxel/luxel/node`)

- **`serveLuxel(options)`:** `{ distDir, port, hostname?, compress? }` → `loadAppFromDist` → `createAppServerFetch` (or `createDeployedFetch` from entry when authors want config defaults) → `node:http` / `http.createServer` bridging to `fetch`.
- **Shutdown:** return handle with `close()` for tests.
- Minimal surface; no cluster/TLS in phase B.

### Module 5: Deno adapter (`@luxel/luxel/deno`)

- Same options and behavior as Node adapter; `Deno.serve` listen glue.
- Shared `dist/`; Deno 2+ npm/specifier compatibility assumed.

### Module 6: Package exports

- Add subpath exports: `./node`, `./deno`, deploy subpath (e.g. `./deploy` or `./server`) exporting `loadAppFromDist`, `createAppServerFetch`, related types.
- CLI bin unchanged (Bun shebang / Bun invocation).

### Module 7: Deploy matrix documentation

- Table: runtime (Bun toolchain, Node deploy, Deno deploy) × capabilities (SSR, compress codecs including zstd gate) × minimum versions.

### Implementation order (mandatory)

1. Encoders  
2. Bundle + `loadAppFromDist`  
3. Adapters  
4. Node integration test + deploy matrix doc  

## Testing Decisions

### What makes a good test

- Assert **external behavior**: HTTP status, headers (`Content-Encoding`, `Vary`), body bytes (decompress round-trip), HTML markers — not encoder internal branches unless isolated in encoder unit tests.
- Deploy tests use **real built `dist/`** from an example app (counter minimum; nav-demo if resource routes needed for regression).
- Do not require Bun on server for Node integration test — spawn `node` subprocess with adapter entry.

### Modules to test

| Module | Test type | Prior art |
|--------|-----------|-----------|
| Compression encoders | Unit: each codec under Bun; Node-capability mocks or conditional `node` subprocess for zstd gate | `compress.test.ts`, `wrapCompress` cases |
| `wrapCompress` + encoders | Existing suite must stay green | `packages/luxel/test/compress.test.ts` |
| `loadAppFromDist` | Unit/integration after build fixture | `build.test.ts`, `createTestServer` pattern |
| Server bundle | Build test: `app.mjs` exists, importable, serves `/` when wired | `build.test.ts` |
| Node adapter | Integration: build counter → `node` spawn → GET `/` → HTML + optional gzip | Playwright/smoke patterns; `createTestServer` |
| Deno adapter | Optional phase B follow-up in same issue or defer with explicit skip | Only if CI has Deno; else document manual matrix |

### CI note

- Framework tests remain `bun test`; Node IT may use `child_process.spawn("node", …)` from Bun test.

## Out of Scope

- v1 **phase A** full toolchain parity (dev/build/bench on Node and Deno).
- Edge runtimes (Cloudflare Workers, Vercel Edge, etc.).
- npm compression codec fallbacks (ADR-0002 follow-up).
- Separate `@luxel/node` / `@luxel/deno` packages (subpaths only unless adapters grow).
- CJS dual emit.
- Streaming response compression (`TransformStream`).
- Build-time static precompression sidecars (`.br`, `.zst`, `.gz`).
- Changing Vite-free / Bun.build toolchain ownership for compile.
- Replacing `Bun.serve` in dev/test harness (stays Bun until v1).

## Further Notes

- **Glossary:** Runtime support policy, Deploy integration, Deploy artifact loading, Node deploy floor, Runtime adapter packaging, Phase B implementation order — `CONTEXT.md`.
- **Related ADRs:** 0003 (this feature), 0002 (compression — encoder slice must align).
- **Risk:** Generated route modules today reference monorepo paths; server bundle step is the critical fix — validate with Node IT early after slice 2.
- **v1 follow-up issue:** toolchain parity can reference ADR-0003 deferred section.
