## Parent

#28 — Phase B: multi-runtime deploy (Node + Deno production server)

## What to build

Extract **runtime-selected compression encoders** from response compression middleware so deploy on Node/Deno never calls `Bun.*` directly.

End-to-end behavior:

- `wrapCompress` delegates encode to encoder module only.
- **Bun:** `Bun.gzipSync`, `Bun.deflateSync`, `Bun.zstdCompressSync` (unchanged behavior).
- **Node/Deno deploy path:** `node:zlib` for gzip, deflate, br; **zstd** only when `zstdCompressSync` exists (Node ≥22.15).
- **Capability probe:** if negotiated codec has no encoder, skip to next mutual codec — never throw mid-request.
- No npm codec dependencies (ADR-0003, ADR-0002 phase B).
- Existing `compress.test.ts` suite stays green on Bun.

## Acceptance criteria

- [ ] Encoder module exposes encode per `CompressionFormat` with runtime selection (Bun vs zlib).
- [ ] `wrapCompress` has no direct `Bun.*` calls.
- [ ] Unit tests cover gzip/deflate/br on current runner; zstd gated when `zstdCompressSync` absent (probe or conditional test).
- [ ] Stream passthrough (`?stream=1`), size floor, MIME denylist, `Vary: Accept-Encoding` behavior unchanged.
- [ ] Aligns with **Compression implementation policy** in CONTEXT.md.

## Blocked by

None — can start immediately.
