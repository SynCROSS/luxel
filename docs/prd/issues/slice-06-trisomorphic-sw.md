## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

**Trisomorphic SW (C3)** on nav-demo: service worker caches **full HTML documents** keyed by route + resource generation from v2 `luxel-data`. Install precaches `/` and `/detail`. **Adaptive navigation:** first visit = normal document load; after SW active, prefer cached HTML when valid; else document fallback to network SSR. **No Render IR in worker.** Per-route `offline:` deferred to slice 11.

Supersedes intent of #26 — close or link when merged.

## Acceptance criteria

- [ ] SW registers on nav-demo; precache or runtime cache stores full HTML + generation metadata
- [ ] Cache hit serves stored HTML without network SSR
- [ ] Cache miss or stale generation falls back to network document/SSR
- [ ] Adaptive nav demonstrable: repeat in-app nav faster via SW when cache warm
- [ ] Test harness or Playwright covers hit and miss paths
- [ ] No executable payloads in SW cache beyond inert HTML/sidecars

## Blocked by

- https://github.com/SynCROSS/luxel/issues/38
