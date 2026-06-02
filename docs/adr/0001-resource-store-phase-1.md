# Resource store — post-prototype phase 1

**Status:** accepted

After the prototype slice exits (thin M11, then fat M11), Luxel’s first post-prototype pillar is a **resource store** shared by server render and client navigation—not trisomorphic service worker work yet. Phase 2 adds an SW that caches full HTML documents keyed by route plus resource generation/etag, reusing the same keys and tags.

## Decision

1. **Pipeline:** `load()` and optional `prefetch(ctx)` (SFC `<script>` exports, same file as `load`) write into the store; render reads the store. Hydration still uses the `luxel-data` sidecar `id`, with a **versioned JSON envelope** (resource map), not a separate `luxel-resources` script tag in v1 of this feature.

2. **Keys:** Compiler-assigned default stable keys from route id and analyzed writes; authors may override keys and tags when needed.

3. **Entries:** Each resource carries **HTTP-style cache metadata** (e.g. `max-age`, stale/revalidate) **and** tag membership for grouped invalidation. **`revalidateTag(tag)` is server-only in phase 1** (loaders, prefetch, later server functions); clients do not call it—they see fresh data on the next full-document navigation after the server invalidates.

4. **Phase 1 scope:** Server + **client nav** (full HTML `fetch` → parse sidecars → merge store → re-hydrate boundaries). No SW, no JSON nav protocol.

5. **Proof:** New two-route demo (e.g. `examples/nav-demo`) with prefetch and tag revalidation. Counter stays the prototype regression fixture.

6. **Phase 2 (separate ADR when started):** SW serves cached HTML on hit; miss → network SSR. No Render IR execution in the worker at entry.

## Considered options

| Topic | Rejected | Why |
|-------|----------|-----|
| Post-prototype order | Trisomorphic SW first | SW nav needs stable resource semantics; store first (A→C). |
| Phase 1 scope | Server-only store | Cannot prove client nav without client store (B). |
| `load` vs store | Parallel `luxel-data` + store (B) | Two truths; render should read one pipeline (A). |
| Keys | Compiler-only or author-only | Hybrid (C) balances ergonomics and control. |
| Cache | Tags-only or HTTP-only | Architecture targets both (C). |
| `revalidateTag` | Client isomorphic (B) | Phase 1 keeps invalidation on server; client reads snapshots (A). |
| Proof app | Extend counter only | One route cannot exercise client nav (B). |
| Sidecar | New `luxel-resources` id | Keep `luxel-data` id; version envelope (B). |
| Client nav | JSON nav payload (B) | Reuse SSR HTML + sidecars in phase 1 (A). |
| SW cache | Resource-only in SW (B) | Weak vs trisomorphic HTML-serving goal (A). |
| `prefetch` | Separate file or inferred only | SFC export beside `load` (A). |

## Consequences

- Manifest and contract tests for `luxel-data` must gain a `version` field and resource shape; counter goldens migrate when the store lands, not before M11.
- Compiler must eventually analyze `load`/`prefetch` for default keys; overrides remain author-visible.
- `docs/prototype-slice.md` and architecture stay the slice overview; this ADR owns post-prototype data-plane shape until superseded.
- Phase 2 SW work should not fork key/tag semantics; only add HTML document caching and offline policy on top.
