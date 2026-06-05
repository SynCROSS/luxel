## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

**ISR (C4b):** pluggable **HTML cache adapter** with **filesystem** implementation. Route `export const revalidate = <seconds>`. Regenerate on TTL **and** when resource store tags/generations stale (`revalidateTag` integration). Redis adapter optional stub — not exit gate.

## Acceptance criteria

- [ ] FS adapter stores rendered HTML + metadata under configurable cache dir
- [ ] `revalidate` seconds honored; stale HTML regenerated on next request
- [ ] Tag invalidation triggers regen for routes depending on tagged resources
- [ ] Adapter interface documented; non-FS backend can be added later
- [ ] Integration tests for TTL expiry and tag-driven regen

## Blocked by

- https://github.com/SynCROSS/luxel/issues/40
