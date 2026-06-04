# Response compression middleware

**Status:** accepted

Luxel serves HTML documents, generated client assets, and (post-prototype) JSON-shaped artifacts over Bun. Responses are currently identity-encoded. This ADR adds optional **response compression middleware** wrapping the app `fetch` handler, with negotiated `Content-Encoding` and safe cache variance.

## Decision

1. **Ownership:** Compression lives in Luxel middleware (`wrapCompress`) around `createAppFetch`, not CDN-only and not a separate reverse-proxy requirement for Bun deploys.

2. **Eligible bodies:** Compress compressible MIME types (`text/*`, `application/javascript`, `application/json`, `application/manifest+json`, …). Denylist already-compressed binary types (`image/*`, `video/*`, `font/woff2`, …). Pick the best **mutual** codec from the client `Accept-Encoding` offer; honor `;q=` when present.

3. **Codec preference (default order):** `zstd` → `br` → `gzip` → `deflate`. Authors may override the ordered list via `CompressOptions`.

4. **Size floor:** Skip compression below a configurable threshold; default **1024 bytes**.

5. **Streaming (v1):** Do **not** compress bodies that are already `ReadableStream` instances (including prototype `?stream=1` SSR). Buffered responses compress normally. Streaming compression via `TransformStream` is deferred.

6. **Dev vs prod defaults:** `luxel dev` and local test servers keep compression **off** unless enabled. Production server entry enables compression by default.

7. **Cache variance:** When `Content-Encoding` is set, merge `Accept-Encoding` into `Vary` (dedupe tokens). Do not add `Vary` when the body stays identity.

8. **Static assets (v1):** Request-time middleware only. Build-emitted `.br` / `.zst` / `.gz` sidecars for immutable `/assets/*` are deferred until `luxel build` owns long-cache static output.

9. **Implementation:** Prefer Bun built-ins (`CompressionStream`, `Bun.*Sync`, `node:zlib`). Optional npm backends implement the same encoder interface. Per-codec backend overrides in config or `wrapCompress` options. On Bun encode failure for a negotiated codec, fall back to npm and emit a **one-time warning per codec**.

10. **Configuration:** Typed `CompressOptions` exported from `@luxel/luxel/server`. Defaults in `luxel.config.ts` under `server.compress`; programmatic options override file config.

11. **Passthrough:** Leave identity when `Content-Encoding` is already set, MIME is not eligible, method is `HEAD`, or status is 1xx, 204, or 304.

## Considered options

| Topic | Rejected | Why |
|-------|----------|-----|
| Ownership | CDN / reverse proxy only (C) | Dev ≠ prod; Luxel is Bun-first and owns the HTTP surface (A). |
| Eligible bodies | HTML only (1) | Client bundle and JSON benefit; negotiation handles codec support (3). |
| Streaming v1 | Compress all streams (A) | Prototype stream spike; complexity and TTFB tradeoffs (B now, A later). |
| Codec order | Brotli-first default (2) | Configurable; zstd-first default for modern HTTPS clients (3 + default 1). |
| Size floor | Always compress (3) | Wastes CPU on tiny 404s (4, default 1024). |
| Dev default | Always on (A) | Local iteration noise; `http://localhost` rarely advertises br/zstd (B). |
| `Vary` | Only on cacheable responses (B) | Under-specified for future SW/HTML caching; merge tokens (C). |
| Static assets v1 | Build sidecars now (B) | Needs build + immutable cache contract first (C). |
| Codecs | npm-only (B) | Violates Bun-first; optional fallback only (C). |
| npm fallback | Auto-only or config-only | Need resilience and explicit overrides (C both). |
| Config | File-only or API-only | Tests need overrides; prod needs defaults (D). |
| Passthrough | `Content-Encoding` check only (A) | Double-encode and bodyless edge cases (D). |

## Consequences

### v1 implementation slice (implemented)

Ship in the first compression PR:

- `wrapCompress` + exported `CompressOptions` + unit/integration tests (middleware enabled explicitly in tests).
- Production build/server entry wraps `createAppFetch` with `wrapCompress` when enabled.
- `luxel.config` loader parses optional `server.compress` (dev default off; prod default on via entry wiring).

Defer to a follow-up PR:

- npm codec backends and failure-triggered fallback (Bun-only path first).
- Streaming `TransformStream` compression.
- Build-time static sidecars (`.br` / `.zst` / `.gz`).

### When to implement

Build the v1 slice **after** post-prototype phase-1 resource store lands ([ADR-0001](./0001-resource-store-phase-1.md)). Tracked on GitHub issue **#27** (blocked by phase-1 issues #19–#25). Compression is orthogonal to the store pipeline but should not compete with phase-1 exit criteria.

### Ongoing

- New `packages/luxel/src/server/compress.ts` (or equivalent) plus tests that enable middleware explicitly (dev default off).
- Production server / build entry wraps `createAppFetch` with `wrapCompress` when `server.compress.enabled` is true.
- `luxel.config` loader gains optional `server.compress` parsing alongside existing roots.
- Integration tests should assert `Content-Encoding`, merged `Vary`, size floor, stream passthrough, and passthrough rules — not rely on dev server defaults.
- Benchmarks reporting client JS **source** size remain unchanged; wire-size wins are a separate metric when documenting compression.
- Phase-2 trisomorphic SW HTML caching must respect `Vary: Accept-Encoding` from this middleware (see ADR-0001 phase 2).
- Domain glossary terms live in root `CONTEXT.md`; this ADR is the durable rationale.

## Related

- Root `CONTEXT.md` — compression glossary entries
- `packages/luxel/src/server/handler.ts` — app `fetch` entry
- `docs/adr/0001-resource-store-phase-1.md` — post-prototype caching and nav (orthogonal; `Vary` must compose)
