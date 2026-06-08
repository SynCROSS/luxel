## Parent

#51

## What to build

ISR cache hit hot path: when HTML cache is fresh, serve stored document bytes directly — no render worker invocation, no resource-store snapshot, no document re-serialization. Miss and regen behavior unchanged (render worker → cache set with tags).

If filesystem adapter is too slow under WinRK load (400 conn), add in-process byte cache or store pre-encoded `Uint8Array` on set. Bench `luxel-isr` server must warm cache before measurement so sustained hits fall within 1s revalidate TTL.

## Acceptance criteria

- [ ] Fresh ISR cache hit returns `x-luxel-cache: hit` without calling render worker
- [ ] ISR miss still renders and populates cache; tag invalidation behavior unchanged
- [ ] `nav-demo-revalidate` / phase-1 server tests pass
- [ ] WinRK `luxel-isr` RPS materially improved toward SvelteKit ISR class (~4,784 baseline)
- [ ] Bench server warms ISR cache before WinRK run

## Blocked by

None — can start immediately (parallel with slice 1).
