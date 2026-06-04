## Parent

#28 — Phase B: multi-runtime deploy (Node + Deno production server)

## What to build

Prove **resource store / client-nav fixture** (nav-demo) on **Node deploy**, not just counter.

End-to-end behavior:

- `luxel build` **nav-demo** → Node `serveLuxel` → GET `/` (and at least one additional route if needed) returns HTML with **`luxel-data`** resource snapshot envelope expected by post-prototype phase 1.
- Confirms bundled server graph works beyond counter-only routes.

## Acceptance criteria

- [ ] Node subprocess (or shared IT harness from #31) serves nav-demo built `dist/`.
- [ ] HTML includes `luxel-data` sidecar with resource envelope shape used by nav-demo tests.
- [ ] No regression to counter Node IT from #31.

## Blocked by

- #31
