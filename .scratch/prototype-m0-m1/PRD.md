# PRD: Luxel Prototype Slice — M0 & M1 (Contracts + Failing Tests)

## Problem Statement

Luxel has architecture docs and a detailed prototype plan, but no executable baseline. Without frozen public artifact contracts and a failing test suite, an AFK agent (or human) cannot safely start the vertical tracer (M2) without re-litigating HTML shape, JSON sidecars, manifest fields, and security boundaries. The team needs M0 to lock the counter **Prototype fixture** and M1 to encode those contracts as tests that fail until M2–M4 land.

## Solution

Deliver **M0** (approved fixture + artifact contracts + inline threat model alignment) and **M1** (Bun unit tests, route integration tests, and one Playwright smoke spec — all red). Tests assert external behavior against the **Generated manifest**, buffered SSR document, JSON sidecars, and hydration boundary markers defined for the prototype slice — not compiler internals.

## User Stories

1. As a Luxel maintainer, I want the counter **Prototype fixture** frozen in the repo, so that all later milestones target one canonical app.
2. As a maintainer, I want a minimal `luxel.config.ts` in the counter example, so that app roots and route directories are explicit before CLI exists.
3. As a maintainer, I want the counter SFC to use `{expr}`, `on:event`, and `hydrate:load` attribute syntax, so that SFC directive vocabulary is exercised from day one.
4. As a maintainer, I want template purity rules documented in tests, so that non-whitelisted expressions fail at compile time once the compiler exists.
5. As a maintainer, I want HTML escaping assumed in SSR expectations, so that XSS-safe defaults are non-negotiable.
6. As a maintainer, I want `unsafe:html` absent from the fixture, so that prototype scope stays narrow.
7. As a maintainer, I want `manifest.json` contract tests, so that route id, path, mode `ssr`, hydration metadata, and asset refs stay stable.
8. As a maintainer, I want SSR HTML contract tests, so that `luxel-data` and `luxel-hydration` sidecars are JSON-only and boundary markers wrap the interactive region.
9. As a maintainer, I want server route module contract tests (`load` then `render`), so that **Render worker** integration has a clear seam.
10. As a maintainer, I want client attach contract tests, so that direct DOM attach ops are the public hydration surface.
11. As a maintainer, I want integration tests to request `/` and assert document shape, so that route SSR behavior is verifiable without a full compiler.
12. As a maintainer, I want Playwright to open the counter page and expect click-to-increment after hydration, so that progressive boundary hydration is proven in a real browser (initially failing).
13. As a maintainer, I want Bun workspace layout scaffolded, so that `packages/luxel`, `packages/bench`, and `examples/counter` match the planned monorepo.
14. As a maintainer, I want `CONTEXT-MAP.md` contexts respected, so that toolchain vs product glossary stay separated as contexts grow.
15. As an AFK agent, I want all M1 tests failing with clear assertions, so that I know when M2 tracer work is complete.
16. As an AFK agent, I want contract snapshots or golden strings derived from `docs/prototype-slice.md`, so that I do not invent divergent HTML/JSON.
17. As a maintainer, I want threat-model rows for XSS, JSON sidecars, and template purity reflected in test intent, so that security constraints are executable.
18. As a maintainer, I want no server functions in fixture tests, so that CSRF/manifest-ID work stays out of scope.
19. As a maintainer, I want no ISR/SSG/trisomorphic SW tests, so that prototype scope does not creep.
20. As a maintainer, I want no competitor benchmarks in M1, so that measurement waits for M10.
21. As a maintainer, I want integration tests to avoid asserting private IR, so that refactors do not break tests unnecessarily.
22. As a maintainer, I want Playwright config isolated under the repo test harness, so that CI can run smoke separately from unit tests.
23. As a maintainer, I want unit tests for JSON sidecar parsing helpers once stubbed, so that client bootstrap contracts are testable in isolation.
24. As a maintainer, I want a test utility to load canonical manifest/HTML fixtures, so that duplication stays low across unit and integration suites.
25. As a maintainer, I want M0 sign-off recorded in the issue, so that contract changes after M0 require explicit approval.
26. As a contributor, I want README/status updated to “M0/M1 in progress”, so that repo state is honest.
27. As a maintainer, I want file-route discovery tests deferred to M7, so that M1 only tests contracts and HTTP behavior stubs.
28. As a maintainer, I want Render worker tests deferred to M4, so that M1 uses a minimal test server or placeholder.
29. As a maintainer, I want signal runtime tests deferred to M3, so that M1 does not test implementation details early.
30. As an AFK agent, I want issue labeled `ready-for-agent`, so that triage can pick this up without more grooming.

## Implementation Decisions

### Scope boundary

- **In scope:** M0 freeze + M1 failing tests only. No compiler, no real `luxel` CLI, no benchmark execution (M2+).
- **Tracer strategy:** M1 tests target expected artifact shapes; M2 implements hardcoded tracer to green the integration subset.

### Deep modules to introduce or extend

1. **Artifact contracts** — Encapsulates canonical `manifest.json`, SSR document, and sidecar JSON shapes. Simple API: load expected fixtures, diff actual vs expected strings/objects. Rarely changes once M0 locks.

2. **Test fixture loader** — Loads golden artifacts for counter route; hides where snapshots live. Used by unit + integration tests.

3. **Minimal test HTTP server** — Serves hardcoded or fixture-backed HTML at `/` for integration tests. Interface: start/stop, base URL. Implementation swappable when M2 tracer arrives.

4. **Playwright smoke harness** — Navigates to counter, clicks button, asserts text. Encapsulates selectors tied to `data-luxel-text` and boundary markers.

5. **App scaffold (counter example)** — `luxel.config.ts` + counter SFC with `load()`, signal counter, `hydrate:load` boundary. No build pipeline required for M0.

6. **Workspace root** — Bun workspaces wiring for packages and examples (package.json files may be minimal stubs).

### M0 deliverables

- Counter **Prototype fixture** SFC and config committed and matching approved syntax.
- Inline threat table in prototype plan acknowledged (no new file required for M0).
- Artifact contract examples treated as source of truth (manifest, SSR HTML, sidecar rules).
- Per-context `CONTEXT.md` stubs optional; root `CONTEXT.md` remains authoritative for product terms.

### M1 deliverables

- Bun test suite with failing cases for: manifest shape, SSR HTML contains escaped content + JSON sidecars + boundary comments, forbidden patterns absent (`unsafe:html`, executable inline scripts).
- Route integration test: GET `/` returns expected document (against stub server or skipped pending M2 with explicit TODO).
- Playwright spec: load page, click counter, expect increment — fails until hydration works.
- All tests runnable via `bun test` (and Playwright command documented).

### Contract highlights (from prototype plan)

Manifest route entry:

```json
{
  "id": "route:index",
  "path": "/",
  "mode": "ssr",
  "hasLoad": true,
  "hydration": [{ "id": "boundary:0", "directive": "load", "componentId": "sfc:index" }]
}
```

SSR sidecars: `luxel-data` holds `load()` result; `luxel-hydration` holds route id + boundaries only — JSON `type="application/json"`, never executable JS literals.

Hydration: explicit `hydrate:load` attribute on interactive region; boundary comment markers in HTML.

Template purity (for future compiler tests, spec now): literals, identifiers, member access only.

### Module interfaces (behavioral, not paths)

- `loadArtifactContract(name)` → parsed golden object or HTML string.
- `assertManifestMatches(actual, expected)` → throws with diff message.
- `assertSsrDocumentMatches(actualHtml, expectedHtml)` → normalizes whitespace optionally; checks required nodes and sidecars.
- `createTestServer({ html })` → `{ url, close }`.
- `runCounterSmoke(page)` → performs click assertion.

### Architectural alignment

- Bun-first monorepo; Vite-free.
- **Generated manifest** is public contract; IR private (no IR tests in M1).
- **Render worker** and **Prototype render worker** (same-process) not implemented in M1 — only contract tests for server module exports if stubbed.
- Multi-context: product glossary at root; toolchain context files may be empty stubs.

## Testing Decisions

### What makes a good test here

- Assert **external** behavior: HTTP response HTML, JSON sidecar contents, manifest fields, Playwright-visible text.
- Do **not** assert Semantic IR / Render IR structure, signal graph internals, or Bun build plugin hooks in M1.
- Prefer golden contracts from M0 over duplicated magic strings in each test file.

### Modules to test (M1)

| Module | M1 testing |
|--------|------------|
| Artifact contracts | Yes — unit tests on golden fixtures |
| Test fixture loader | Yes — smoke test it loads all contracts |
| Minimal test HTTP server | Yes — integration test serves fixture HTML |
| Playwright smoke harness | Yes — e2e spec (expected fail) |
| App scaffold | Indirectly — via HTML/fixture presence |
| Compiler / CLI / bench | No — later milestones |

### Prior art

- No existing Luxel tests yet. Follow Bun native test runner. Playwright pattern to be established in this issue.

### Expected state after M1

- `bun test` runs; contract + integration tests fail or skip with explicit “requires M2 tracer” where needed.
- Playwright fails on counter increment until M3/M11 hydration works.

## Out of Scope

- M2+ vertical tracer, runtime signals, Render worker impl, Semantic/Render IR compiler, real `luxel dev|build|bench`, benchmark numbers, competitor comparisons, ISR/SSG, trisomorphic SW, server functions, auth, plugins, worker pools, `bun build --compile`, fine-grained HMR, compiler-chosen hydration boundaries, expanding template purity beyond minimal whitelist, full `docs/threat-model.md` file (inline table sufficient for prototype).

## Further Notes

- Implementation order after this PRD: M2 hardcoded tracer greens integration tests; M3/M4 parallel per prototype plan.
- GitHub labels `needs-triage` etc. must exist on repo for triage skill; this issue uses `ready-for-agent` only.
- Reference: `docs/prototype-slice.md`, `docs/architecture.md`, root `CONTEXT.md`, `CONTEXT-MAP.md`.
