## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

**Offline policies (C4e):** hybrid `offline: none | static | stale | custom` on trisomorphic SW. Compiler infers defaults (`static` for prerender/SSG, `stale` for ISR, `none` for dynamic SSR); `export const offline` override in route SFC.

## Acceptance criteria

- [ ] Manifest records offline mode per route
- [ ] SW behavior differs measurably for at least `static` vs `stale` vs `none` on nav-demo or docs fixture
- [ ] Author override `offline = "none"` on ISR route disables stale SW serve
- [ ] Tests or Playwright script document expected offline behavior

## Blocked by

- https://github.com/SynCROSS/luxel/issues/42
