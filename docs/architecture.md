# Luxel Architecture (compact)

**Product:** Luxel · **Packages:** `@luxel/*` · **CLI:** `luxel` · **Runtime:** Bun-first

## 1. Goals

| Axis | Target |
|------|--------|
| Tooling | Vite-free hard ban (no Vite, Rollup, Vite plugin API) |
| Runtime | Bun-first; Node/edge adapters later |
| Client | Fine-grained reactive DOM; signals + compiler sugar |
| Render | Streaming SSR, progressive hydration, SSG, ISR, trisomorphic (server + page + SW) |
| Perf | Smallest JS, fastest hydration/INP, SSR throughput, build/HMR, Web Vitals (scorecard + per-metric) |
| Security | No RSC-style payloads; hardened server fns; compiler + runtime + supply chain |
| v1 | Stable 1.0 with full feature set, semver + stability matrix + migrations |

## 2. Stack

```
SFC → layered compiler (private IR) → public manifests
    → Bun.build() bundling
    → Oxc parse/transform for <script> analysis
    → framework-owned dev graph + HMR
```

## 3. Authoring

- HTML-like SFC; strict compile errors; `unsafe:*` escape hatches
- Pure template expressions + whitelisted pure calls
- HTML escape default; `unsafe:html` + sanitizer + TrustedHTML
- Scoped CSS default; Shadow DOM opt-in
- Compiler-decided hydration boundaries; `hydrate:load|visible|idle|interaction|never`

## 4. Compiler pipeline

```
SFC AST → Semantic IR → Render IR → Target IRs
```

| Target | Output |
|--------|--------|
| SSR | string/stream chunks |
| Client | template clone + binding attach |
| Islands | direct DOM when smaller/faster |
| SW | same templates/routes as server |
| CSS | scoped + critical inline + hashed chunks |
| Public | manifests + diagnostics only |

## 5. Rendering

| Condition | Mode |
|-----------|------|
| Static data | SSG |
| `revalidate` | ISR |
| req/session/cookies/headers | SSR (render worker) |
| Client-only APIs | CSR island |

**Stream:** HTML-first + optional inert JSON sidecars (data, hydration manifest, resources). JSON only — no executable literals.

**Workers:** SSR + build worker pools; adaptive sizing; priority SSR > ISR > build; backpressure. Dev: shared workers; prod: process isolation for untrusted/plugins.

**Cache:** FS default; pluggable adapters (Redis/KV/CDN).

## 6. Trisomorphic (web.dev)

Same templating + routing on server, browser page, and service worker. SW renders full HTML when route/template/data cached; else server streaming SSR. Per-route offline: `none | static | stale | custom`. Adaptive navigation: MPA initial → SW/client when faster → document fallback.

## 7. Routing & data

- File routes + code routes (API/middleware); compiler-generated manifest
- `load()` + `prefetch()` + server functions (forms + JSON RPC, same manifest)
- Resource store: HTTP cache semantics + tags + stable keys
- No auto global state serialization; opt-in client stores

## 8. Security

- No server components (React sense)
- Server fns: manifest IDs, schema validation, CSRF/origin/session, JSON/structured-clone types only
- CSP + Trusted Types hooks
- Signed releases; allowlisted compile hooks/macros
- Plugins: declarative first; WASM sandbox; trusted JS worker/process dev-only

## 9. Auth & DB

- Auth: built-in session primitives + provider adapters; opaque session cookie → store; JWT not default
- DB: data-access contract + `@luxel/db-*` helpers; Postgres + SQLite first; no ORM
- Default auth schemas/migrations + custom adapter escape hatch

## 10. Dev / deploy / DX

- HMR: framework graph + Bun transpile; full reload on unsafe edits
- Config: conventions + generated manifest
- Deploy: app folder, `bun build --compile`, platform adapters later
- API: Web `Request`/`Response` public; Bun-native internals + escape hatch
- AI-friendly: manifests, stable diagnostic codes, fix-its, codemods
- Test: Bun test + route/component/server-fn harness + Playwright fixture
- Observability: OpenTelemetry + Web Vitals reporter
- Docs site: dogfood Luxel from day one

## 11. Benchmarks

Shared fixtures: micro (counter/list/table), app (blog/dashboard/ecommerce/auth), server stress (dynamic route, stream, ISR). Compare React, Vue/Vapor, Solid, Svelte, Fastify, Luxel. Weighted scorecard; publish per-metric; no category may regress badly.

## 12. Implementation order

1. This spec + threat model outline
2. Prototype: SFC slice + Bun build + SSR worker + one route
3. Benchmark harness skeleton
4. Hydration, ISR, auth, SW trisomorphic, plugins
5. Docs site (also a benchmark fixture)

## 13. ADR candidates (write when locking)

- Bun-first + Bun.build core
- No server components
- JSON-only stream sidecars
- Private IR / public manifests
- Trisomorphic SW fallback policy

## 14. Open

- Exact SFC directive grammar
- Resumability timeline (post-1.0)
- Edge adapter priority after Bun/Node
- Benchmark scorecard weights
