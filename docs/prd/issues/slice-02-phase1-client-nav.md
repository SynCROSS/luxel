## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

**Phase-1 client navigation** on nav-demo (counter stays SSR-only regression):

- Opt-in `data-luxel-nav` delegated click handler
- Full HTML `fetch` → parse v2 sidecars → generation-based **client store merge** → DOMParser `<main>` swap → `pushState` → re-hydrate boundaries
- `popstate` → full document navigation (no client-managed back yet)

Playwright: forward nav `/` ↔ `/detail` without full reload.

Supersedes intent of #24 — close or link when merged.

## Acceptance criteria

- [ ] nav-demo links use `data-luxel-nav`; forward nav does not reload entire page
- [ ] Client merges resources by stable key; incoming generation ≥ local wins
- [ ] Hydration after nav uses binding map + v2 snapshot projection
- [ ] `popstate` triggers full document load (test or manual script documented)
- [ ] Playwright test green in CI for nav-demo route change
- [ ] Counter Playwright/smoke unchanged in scope

## Blocked by

- https://github.com/SynCROSS/luxel/issues/35
