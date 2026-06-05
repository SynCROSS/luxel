## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

End-to-end **phase-1 server** resource pipeline on counter + nav-demo:

- `load()` / `prefetch()` return `void` and only write the **resource store**
- SSR runs `prefetch` → `load` → **render-from-store** (never `load` return values)
- **Template binding map** in generated manifest; framework projects store → template bindings
- **`luxel-data` v2** sidecar: `{ "version": 2, "resources": <ResourceSnapshot> }` (no duplicate flat bindings JSON)
- Counter + nav-demo migrated; contract goldens updated in same change set

Demoable via SSR/integration tests and built HTML assertions (no client nav yet).

Supersedes intent of #20, #21, #23 — close or link when merged.

## Acceptance criteria

- [ ] Render worker and route modules use store-only data path; `load`/`prefetch` typed/compiled as `void`
- [ ] Manifest includes template binding map for counter and nav-demo routes
- [ ] SSR HTML contains v2 `luxel-data` envelope; contract tests and goldens green
- [ ] Server runs `prefetch` before `load` before render when `prefetch` export exists
- [ ] `examples/counter` and `examples/nav-demo` routes work on SSR; counter remains regression fixture
- [ ] Tag revalidation behavior on nav-demo still passes server-side tests

## Blocked by

None — can start immediately
