## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

**SSG (C4a):** `luxel build` pre-renders eligible routes to static HTML under `dist/static/`. Production handler serves static files before render worker. **Hybrid `prerender`:** compiler infers static routes when `load`/`prefetch` do not read cookies/headers/session; authors override with `export const prerender = true | false`.

## Acceptance criteria

- [ ] At least one nav-demo or docs-bound route pre-renders to `dist/static/` on build
- [ ] Production fetch serves static HTML for prerendered paths without running full SSR
- [ ] Manifest records prerender mode per route
- [ ] Override `prerender = false` forces SSR on a route that would infer static
- [ ] Integration test: static file served with correct v2 sidecar content

## Blocked by

- https://github.com/SynCROSS/luxel/issues/35
