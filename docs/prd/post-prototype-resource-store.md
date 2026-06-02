# PRD: Post-Prototype — Resource Store (Phase 1) + Trisomorphic SW (Phase 2)

**Tracker:** [GitHub #13](https://github.com/SynCROSS/luxel/issues/13)  
**Child issues:** #19–#26 · **ADR:** [docs/adr/0001-resource-store-phase-1.md](../adr/0001-resource-store-phase-1.md)

## Problem Statement

The prototype slice proves compile → SSR → hydrate → build on a single demo, but Luxel’s architecture promises cache-aware data with HTTP semantics and tags shared across server render, client navigation, and eventually a service worker. Without a **resource store** and a dedicated **nav-demo** app, there is no way to validate prefetch, tag revalidation, client-side store merge, or SW HTML caching without overloading the counter fixture.

## Solution

**Phase 1** introduces a **resource store** on server render and client navigation: `load()` and `prefetch(ctx)` write resources; render reads the store; hydration uses a versioned `luxel-data` JSON envelope. Prove the design on **`examples/nav-demo`** (two routes, prefetch, tag revalidation). **Phase 2** adds a **trisomorphic service worker** that caches full HTML documents keyed by route plus resource generation/etag, reusing phase-1 keys and tags.

## User Stories

### Phase 1 — Resource store

1. As a route author, I want `load()` to populate the resource store, so that render reads a single source of truth.
2. As a route author, I want optional `export async function prefetch(ctx)` in the SFC script, so that I can warm resources before navigation.
3. As a Luxel maintainer, I want compiler-assigned default stable resource keys with author overrides, so that deduplication and invalidation are predictable.
4. As a Luxel maintainer, I want each resource entry to carry HTTP cache metadata and tags, so that CDN and grouped invalidation semantics align with architecture.
5. As a Luxel maintainer, I want `revalidateTag` as a server-only API in phase 1, so that clients see fresh data after the next full-document navigation.
6. As a developer, I want `luxel-data` to keep the same sidecar `id` with a versioned resource envelope, so that hydration contracts evolve without a second script tag.
7. As a developer, I want client navigation to `fetch` full HTML and parse sidecars, so that phase 1 reuses the SSR pipeline without a JSON nav protocol.
8. As a developer, I want in-app navigation to merge the client resource store and re-hydrate boundaries, so that repeat navigations benefit from cached resources.
9. As a Luxel maintainer, I want `examples/nav-demo` with list + detail routes, so that client nav and prefetch are demoable.
10. As a Luxel maintainer, I want counter tests to remain the prototype regression suite, so that nav-demo does not replace counter goldens.
11. As a Luxel maintainer, I want manifest and contract tests updated for `luxel-data` v2, so that public contracts stay explicit.

### Phase 2 — Trisomorphic SW

12. As a developer, I want the service worker to serve cached full HTML on cache hit, so that repeat navigations can skip network SSR.
13. As a Luxel maintainer, I want SW cache keys to include route plus resource generation/etag, so that staleness matches the resource store.
14. As a Luxel maintainer, I want SW miss to fall back to network SSR, so that behavior degrades safely.
15. As a Luxel maintainer, I want phase 2 to reuse phase-1 resource keys/tags without forking semantics, so that ADR-0001 remains authoritative for data identity.

## Implementation Decisions

- **Order**: Phase 1 (resource store) before Phase 2 (SW); see ADR-0001.
- **Pipeline**: `load` / `prefetch` → resource store → render; no parallel ad-hoc `load` return path for render.
- **Keys**: hybrid compiler defaults + author override (ADR).
- **Cache entries**: HTTP metadata + tags; `revalidateTag` server-only in phase 1.
- **Sidecar**: `luxel-data` id unchanged; JSON `version` + resource map.
- **Client nav**: full HTML fetch → parse sidecars → merge store → re-hydrate (ADR).
- **Proof app**: `examples/nav-demo`, not counter extension.
- **Phase 2 SW**: HTML document cache; no Render IR in worker at entry (ADR).

### Deep modules (proposed)

| Module | Interface | Notes |
|--------|-----------|-------|
| Resource store | `get/set`, tags, HTTP metadata, generation/etag | Core; server + client implementations share key semantics |
| Resource snapshot | serialize/deserialize for `luxel-data` v2 | Public hydration contract |
| Route data pipeline | orchestrate load/prefetch/render | Replaces direct `load()` → template data |
| Client nav runtime | fetch HTML, merge store, hydrate | Builds on existing `hydrateRoute` |
| Compiler resource analysis | default keys from `load`/`prefetch` writes | Extends compile pipeline |
| SW cache layer | match/install/fetch handler | Phase 2 only |

## Testing Decisions

- Integration-style tests: nav-demo routes end-to-end, sidecar shape, tag invalidation visible on second request.
- Contract tests: golden `luxel-data` v2 envelope; do not assert private store internals.
- Playwright: client nav between nav-demo routes without full page reload where applicable.
- Phase 2: SW tests with controlled cache hit/miss (Playwright service worker or unit harness).

## Out of Scope

- Auth, server functions (except future hook points), ISR/SSG production modes, plugin API.
- JSON partial navigation protocol (phase 1).
- Client-side `revalidateTag` (phase 1).
- Competitor benchmarks, fine-grained HMR, `unsafe:html`.
- Full `docs/threat-model.md` file (inline prototype table still sufficient until later).

## Further Notes

- Parent ADR: `docs/adr/0001-resource-store-phase-1.md`.
- Phase 2 should add ADR-0002 when started.
- Prototype slice (delivered) must be green before starting phase 1 slices.
