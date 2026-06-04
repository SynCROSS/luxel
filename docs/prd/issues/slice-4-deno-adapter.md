## Parent

#28 — Phase B: multi-runtime deploy (Node + Deno production server)

## What to build

**Deno production adapter** using the **same `dist/`** as Node.

End-to-end behavior:

- Package subpath **`@luxel/luxel/deno`** exports **`serveLuxel`** with same options as Node adapter.
- `Deno.serve` listen glue → same `loadAppFromDist` → `createAppServerFetch` pipeline.
- Manual or CI verification: built counter `dist/` serves `/` under Deno 2+.
- Deploy matrix updated with Deno deploy row (toolchain still Bun-only).

## Acceptance criteria

- [ ] `package.json` exports `./deno`.
- [ ] Deno adapter loads shared ESM `dist/` (no Deno-specific emit).
- [ ] Documented smoke steps if CI lacks Deno; add Deno IT when runner available.
- [ ] Deploy matrix includes Deno 2+ deploy column.

## Blocked by

- #31
