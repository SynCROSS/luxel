## Parent

#28 — Phase B: multi-runtime deploy (Node + Deno production server)

## What to build

**Node production adapter** + CI proof that counter deploys without Bun on the server.

End-to-end behavior:

- Package subpath **`@luxel/luxel/node`** exports **`serveLuxel({ distDir, port, hostname?, compress? })`**.
- Flow: `loadAppFromDist` → `createAppServerFetch` (respect `dist/server/entry.js` / `productionCompress` defaults when appropriate) → `node:http` bridges to Web `fetch`.
- Return handle with **`close()`** for tests.
- Integration test: `luxel build` counter → spawn **Node** subprocess (not Bun) → GET `/` → HTML contains expected SSR content.
- With `Accept-Encoding: gzip` (or br), response has correct `Content-Encoding` and round-trip decompresses (requires #29 encoders on Node path).
- **`internalRoutes`** not enabled in default production adapter.
- **Deploy matrix** doc table: Bun toolchain vs Node deploy × SSR × compression codecs (incl. zstd gate Node 20+ vs ≥22.15).

## Acceptance criteria

- [ ] `package.json` exports `./node` (and deploy subpath if not done in #30).
- [ ] Node IT in `bun test` via `child_process.spawn("node", …)`.
- [ ] Production compress works on Node deploy for at least gzip/br.
- [ ] zstd skipped without crash on Node versions without `zstdCompressSync`.
- [ ] Deploy matrix section added (CONTEXT link or `docs/` table).
- [ ] Default adapter does not expose `__luxel/revalidate`.

## Blocked by

- #29
- #30
