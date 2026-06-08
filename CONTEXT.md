# Luxel

Vite-free web framework: compiled SFCs, streaming SSR, progressive hydration, trisomorphic rendering (server + page + service worker). **Bun-first toolchain** pre-v1; **multi-runtime deploy** on Node and Deno before v1 full parity.

## Language

**Luxel**: The framework and toolchain (`@luxel/*` packages, `luxel` CLI).

**Product north star:** **Luxel-native** — `.luxel` SFCs, Luxel compiler/runtime/manifest, resource store, trisomorphic rendering. **Not** a Svelte 5 compiler fork. **Comparison class:** SvelteKit-class app framework in the **TypeScript UI ecosystem** (bench + design targets: React, Vue, Svelte, Solid) with **Vite-free** toolchain and **evidence-backed** perf claims. **Rejected:** ground-up non-TS syntax/runtime rewrite — stay interoperable with TS authoring, npm packages, and mainstream framework patterns.

**Runtime compatibility (locked):** Luxel apps and **`@luxel/luxel` deploy surface** must run on **Bun**, **Node 20+**, and **Deno 2+**. **Toolchain phasing:** Bun-only `luxel dev` / `build` / `bench` through **v1.0**; full toolchain parity on all three runtimes at **v1.1** (ADR-0003). Production **server** on Node + Deno is in scope for v1.0.

**v1.1 toolchain priority (locked):** **Native host** (`luxel-node`, `luxel-deno`) on Node and Deno (no Bun on PATH for `luxel dev` / `build` / `bench`) is **same priority** as finishing **v1.0 exit gates** (C4 features, perf tiers, four package managers) — **parallel tracks**, not deferred behind bench-only work.

**Release tagging (locked):** **Two stable tags.** **`v1.0`** when app-framework + perf + package-manager exit gates pass (author toolchain may still require Bun). **`v1.1`** when `luxel dev` / `build` / `bench` + framework tests pass on **Node and Deno with no Bun on PATH**. Host parity work proceeds in parallel but does not block the `v1.0` tag.

**v1.1 host implementation (locked):** Begin **native host** work in the **v1.0 implementation cycle** (same priority track). **Node + Deno together** — no Node-only v1.1-rc; first **`v1.1-rc`** only when **both** pass host CI **without Bun on PATH**. **`luxel-host.mjs` Bun-spawn bridge rejected and removed** — no subprocess fallback to Bun on Node/Deno.

**v1.1 compile backend (locked):** **C** — **esbuild** for v1.1-rc bundling + Luxel-owned SFC compiler; **WASM** core swap later behind same CLI/API. Entries: `packages/luxel/bin/luxel-node.mjs`, `packages/luxel/bin/luxel-deno.ts`.

**Perf compiler track (locked):** **Dual track, gated sequence** — no Rust work blocks v1.0 spiral gate. **(1) Phase 0 (TS) — exited 2026-06-08:** compiled SSR codegen shipped (`{#each}` / list lowering, document payload policy, ISR hot-path cache serve). **ISR hot path (locked):** cache **hit** serves stored HTML bytes from adapter with **no render worker**, **no resource-store snapshot**, **no document re-serialization**; miss/regen unchanged. Bench ISR row expects sustained hits within TTL (WinRK `luxel-isr` = 1s revalidate, warmed cache). **Exit proven (WinRK 8t / 400c / 10s, Windows):** spiral `luxel-spiral-ssr` ~873 RPS (factor ~0.70 vs ~614 fastest {Vue vdom, Solid}); ISR `luxel-isr` ~4,459 RPS (factor ~0.41 vs SvelteKit ISR ~1,809); `luxel bench --gate` green (`ssr` + `isr` tiers, geo-mean ≤ 1.08). Artifacts: `docs/benchmarks/runs/winrk-spiral-latest`, `winrk-latest`. **Phase 0.5 static subtree freeze — not needed.** **(1b) Phase 0.5 (TS, conditional):** static subtree freeze for zero-binding templates — **deferred** (Phase 0 passed spiral gate). **(2) luxel-core SSR (Rust):** native SSR for hot routes behind same `renderRouteDocumentFromStore` ABI; napi-rs (Node/Bun) + Deno FFI. **Unblocked — Phase 0 green.** **Exit:** spiral + counter full-render parity vs Phase 0 TS baseline (no regression; target ≥ Phase 0). **(3) luxel-core bundler:** ships as `BundleBackend` id **`wasm`** (WASM build of `luxel-core`; native addon optional). **Start only after luxel-core SSR green.** esbuild remains v1.1-rc default until `wasm` backend passes host CI. See [ADR-0005](./docs/adr/0005-luxel-core-phased-rollout.md).

**luxel-core**: Rust crate (`crates/luxel-core`) — Luxel SFC parse/IR, compiled SSR execution, and (phase 3) bundling. Consumed from JS via napi-rs / WASM / Deno FFI; not a separate product surface.

**Compiled SSR codegen**: Compiler emits route-specific render functions (loops, static buffers) instead of interpreting a runtime `DomOp` tree via `codegenSsrDocument` on every request. Phase 0 ships in TS; luxel-core SSR replaces hot paths in phase 2.

**List iteration (`{#each}`)**: Template block `{#each expr as item}` … **`{/each}` required** (Svelte-shaped; no self-closing single-child shorthand in Phase 0). Compiler emits native `for` loop in `renderRouteDocumentFromStore` — not N× static `element` ops. **`{#each}` binding:** list identifier in `expr` (e.g. `tiles`) maps to resource store key **`${routeId}:${listId}`** by default when `load`/`prefetch` writes an array to that key; author override via explicit `.set("custom:key", …)` + compiler-inferred key from `store.set` first arg. **Numeric style coords (locked):** when loop body binds `left`/`top` from numeric item fields in `style=""`, codegen emits `.toFixed(2)` in the loop (SynCROSS / spiral fairness); general filter/pipe syntax deferred. Destructuring (`as { x, y }`) deferred unless needed.

**Document payload policy**: Which SSR document artifacts ship on a route — `luxel-data` sidecar, `luxel-hydration` sidecar, client `<script type="module">`. **Default (compiler-inferred):** omit each artifact when no client consumer exists on that route — no `hydrate:*` boundaries, no `data-luxel-nav`, no attach bind points needing client handoff. Spiral (zero interactivity) gets **HTML + `<head>` styles only** with no sidecars or client entry. **Override precedence (locked):** (1) `hydrate:*` on template elements forces boundary + hydration sidecar + client script when attach ops exist; (2) route SFC script export `export const client = { hydration: 'never' | 'auto' }` — **`'never'` + any `hydrate:*` → compile error**; (3) **`luxel.config.ts` `routes[path].client.hydration` applies only when the SFC omits `export const client`** — SFC export wins on conflict; (4) inference when SFC exports `'auto'` or omits client export and config is silent. Manifest records resolved `client.hydration` and `shipSidecars` flags — public contract.

**Package manager compatibility (locked):** Luxel apps must install and build with **npm**, **pnpm**, **yarn**, and **bun** — standard `package.json` / workspace layouts only; no lockfile-specific hacks. Published `@luxel/*` packages are registry-installable from any of the four. **v1.0 exit gate:** CI on main runs install + `luxel build` + core tests on **all four** package managers (npm, pnpm, yarn, bun).

**Performance claim ladder (locked):** When perf goals conflict, resolve in this order: **(1) Web Vitals / INP** — **hybrid measurement (locked):** **v1.0 exit gate** = Playwright lab on micro fixtures (`examples/counter`, `examples/nav-demo`): hydrate + representative clicks (`data-luxel-nav`, counter increment); emit JSON `inp_ms` (interaction latency proxy). **Pass bar:** per interaction `inp_factor = inp_luxel / inp_fastest` among {Luxel, React, Vue, Svelte, Solid} in the same CI run; **geometric mean ≤ 1.08** across all gated micro interactions; publish median. **Nightly / non-blocking** = Lighthouse (or equivalent) on `examples/docs-site` deploy smoke. **Post-launch optional** = CrUX / field Web Vitals dashboard — not a v1.0 merge gate for a greenfield repo. **(2) Server render throughput** — SSR, ISR, SSG, and trisomorphic paths exercised **per HTTP request** through the **render worker** (no “render once, serve static string” competitor shortcuts; each iteration runs the same pipeline authors get in production). **RPS methodology** follows the [Platformatic SSR performance showdown](https://blog.platformatic.dev/ssr-performance-showdown): CPU-bound, **large non-trivial HTML** (reference workload: ~2.4k positioned tile `div`s — spiral pattern), **production build**, HTTP server + **fresh synchronous render per request** (Luxel: render worker; competitors: each framework’s `renderToString` / equivalent inside the same Fastify-or-`fetch` harness). **v1.0 pass bar (tier 2):** for each cell in `{ssr, isr, ssg, sw} × {micro fixtures + docs-site}`, factor `rps_fastest / rps_luxel` (or equivalent latency ratio); **geometric mean ≤ 1.08** across all cells; publish median factor. **Stretch:** same as tier 3 podium — top-3 per cell (non-blocking). **(3) Client interactivity** — [js-framework-benchmark](https://krausest.github.io/js-framework-benchmark/current.html) **full table parity** at **v1.0 exit**: every scenario the public krausest table publishes, Luxel runner + `.luxel` implementations under **published krausest conditions** (warmup, Chrome driver, keyed/non-keyed variants as listed). **v1.0 blocked** until the full matrix is runnable and published — no `pending` rows for Luxel on krausest tier. **v1.0 pass bar (tier 3):** for each published scenario, compute **factor** `duration_luxel / duration_fastest` (fastest = minimum duration among {Luxel, React, Vue, Svelte, Solid} in the same CI run). **Exit gate:** **geometric mean** of all scenario factors ≤ **1.08** (Luxel within 8% of fastest on average across the full table); report **median factor** alongside geo mean for transparency. **Stretch (non-blocking):** **podium** — Luxel in **top 3** on **every** scenario; public “fastest framework” copy only after stretch is met (or cite specific winning rows honestly). **(4) Bytes** — **v1.0 gate:** **served transfer** on first navigation for `examples/counter` + `examples/docs-site` — HTML + JS + CSS over the wire (respect production compression when enabled); per fixture compute `transfer_factor = bytes_luxel / bytes_fastest` among {Luxel, React, Vue, Svelte, Solid}; **geometric mean ≤ 1.08** across those fixtures; publish median. **Publish only (no v1.0 gate):** toolchain footprint — install size (`node_modules` or published package tarball), `luxel` CLI cold start — tracked in scorecard for DX honesty, not merge-blocking.

**Benchmark fairness (locked):** Counter SSR rows share visible DOM contract (`docs/benchmarks/fairness.md`). Framework rows = per-request render; `static-http` / `fastify-static` = labeled ceilings only; `fastify-html` = Platformatic templating baseline. Publish `ssr_html_bytes` beside rps — Luxel prod document is heavier than minimal competitor shell by design.

**Idiomatic peak benchmark row (locked):** Every framework comparison row (Luxel included) — **CSR and SSR** — must use that framework’s **fastest idiomatic** reactive authoring (e.g. Svelte runes/`$state`, Vue `ref`, Solid `createSignal`, React `useState`), not static HTML or literal markup pasted into templates. Initial rendered output still satisfies the fixture DOM contract (counter button shows `0`). Optimize each row within framework conventions (production build, correct runtime entry — e.g. Vue Vapor `createVaporApp`, `vapor` SFC compile); static-string shortcuts are invalid comparison rows. **Shared component source:** CSR and SSR for a given stack share one component file (e.g. Vue Vapor `App.vue`) — no duplicate inline SSR-only markup. **Counter:** applies to every framework row (React, Vue vdom/vapor, Solid, Svelte, Luxel); Luxel row = `examples/counter`. **Spiral:** shared spiral component per framework under `packages/luxel/src/bench/competitors/`; implementations follow [SynCROSS/ssr-performance-showdown](https://github.com/SynCROSS/ssr-performance-showdown/tree/main) (Platformatic rules — no client reactivity). **Vue Vapor spiral:** port SynCROSS `vue/client/base.vue` with `<script setup vapor>` + `createVaporApp` (no upstream vapor row — Luxel extends vdom reference).

**v1.0 performance exit (locked):** One CI job (`luxel bench --gate`) must pass **all four tier gates** in the **same run** before the v1.0 tag. **Competitor fairness:** fastest/min denominators include only frameworks **actually executed** in that run; `pending` runners are excluded from the comparison set — never count as a win. Luxel must still satisfy every gate against whichever competitors ran; missing runners narrow the published matrix until wired.

**SFC**: Single-file component — HTML-like `<template>`, `<script>`, `<style scoped>`. Compiler-owned; not general HTML.

**Signal**: Fine-grained reactive primitive (`signal`, `computed`, `effect`). Runtime truth; compiler may sugar over it.

**Route loader**: Server `load(ctx)` that fetches data for a route/layout before render.

**Prefetch**: Explicit `prefetch(ctx)` run before render; compiler validates/optimizes resource reads. Client may add speculative prefetch on navigation.

**Server function**: Typed mutation/action invoked via form or JSON RPC. Compile-time manifest ID only — no client module refs.

**Render worker**: Bun worker that runs SSR, SSG, or ISR regeneration.

**Build worker**: Bun worker for compile, SSG, and ISR regen jobs.

**Hydration boundary**: Compiler-chosen (or `hydrate:*` override) region where client attaches interactivity.

**Trisomorphic rendering**: Same templates/routing on server (streaming SSR), browser page (hydrate + nav), and service worker (cached HTML nav). Per [web.dev](https://web.dev/articles/rendering-on-the-web#trisomorphic-rendering).

**Resource store**: Cache-aware async data layer with HTTP semantics, tags, and stable keys — shared across server, SW, and client nav.

**Generated manifest**: Inspectable compiler output for routes, render mode, data deps, security, and hydration — public contract; IR stays private.

**Route analysis**: Compiler artifact from one SFC parse — template IR, script analysis (modes, exports, server-fn IDs), binding inputs, and client flags — before codegen. Consumed by `compileRoute`, tests, and manifest assembly.

**Route runtime module**: Per-route bundled `server.mjs` exporting `load`, optional `prefetch`, and `renderRouteDocumentFromStore`. Dev `CompiledRoute` and deploy `loadAppFromDist` delegate to the same module (no parallel closure render path).

**Request resolution pipeline**: Ordered fetch stages inside `createAppFetch` (auth → server-fn → internal → SW → assets → page strategies → render). `wrapCompress` stays outer.

**Bench fixture contract**: Public `@luxel/luxel/bench` seam — `createBenchServer`, test-server helpers, and shared metrics shape for `luxel bench` + WinRK. **Competitor source of truth:** shared counter/spiral component sources + SSR render helpers live under `packages/luxel/src/bench/competitors/`; WinRK (`packages/bench`) imports `@luxel/luxel/bench` — no duplicate inline SSR markup. `packages/bench/competitors/` = CSR production Vite builds + framework deploy artifacts only. CSR build sync resolves sources via `competitorSource()` from `@luxel/luxel/bench` (not relative `../../luxel` paths).

**Spiral bench fixture**: Tier-2 [Platformatic SSR showdown](https://blog.platformatic.dev/ssr-performance-showdown) workload; spiral competitor implementations reference [SynCROSS/ssr-performance-showdown](https://github.com/SynCROSS/ssr-performance-showdown/tree/main) — `examples/spiral`. **Luxel spiral SFC (locked):** `load()` writes `computeSpiralTiles()` to store (`ctx.store.set(…)` — default key `${routeId}:tiles`); template `{#each tiles as t}` … `{/each}` (not static ~2.4k-`div` bake). `cellSize = 10` per SynCROSS. No compile-time HTML precompute; **render worker** runs full SSR every request. **Spiral consistency:** per-request framework SSR; **no client-side reactivity** (differs from counter idiomatic-peak). Metrics: `ssr_throughput_rps` (HTTP pipeline), `render_worker_throughput_rps` (direct `worker.render`), `spiral_tile_count`. **WinRK:** `WINRK_FIXTURE=spiral` → `winrk-spiral-latest.*`; stacks `luxel-spiral-ssr`, `react-spiral-ssr`, `vue-*-spiral-ssr`, `solid-spiral-ssr`, `svelte-spiral-ssr`.

**WinRK harness (locked):** Default **8 threads** (`-t8`), **400 connections**, **15s** duration. One stack measured at a time — **sequential** `runWinrkStack` loop; no concurrent stack servers or overlapping winrk runs. **No bundled multi-fixture run** — drop `WINRK_FIXTURE=all`; invoke counter and spiral as separate `bench:winrk` runs with distinct output basenames (`winrk-latest.*`, `winrk-spiral-latest.*`). Unknown `WINRK_FIXTURE` → stderr warning + **counter fallback** (no exit); quotes stripped (`"spiral"` → `spiral`).

**Prototype slice**: First executable Luxel milestone: one route, one SFC, SSR stream, client hydration boundary, Bun build, dev reload, and benchmark harness stub. Excludes auth, ISR, trisomorphic SW, and plugin API.

**Prototype fixture**: Counter demo app at `examples/counter` with async `load()` message, SSR-rendered HTML, one signal, one event binding, scoped CSS, and one hydration boundary.

**Prototype IR**: Two private compiler layers only: **Semantic IR** for SFC meaning and validation, then **Render IR** for SSR ops, client attach ops, and hydration boundary metadata. Target IRs deferred past prototype slice.

**Prototype hydration policy**: Prototype uses explicit `hydrate:load` as an element attribute on the interactive region. Compiler-chosen hydration boundaries are deferred until after the prototype slice.

**Prototype boundary SSR**: Elements carrying `hydrate:*` directives are preserved in SSR HTML (including wrapper elements such as `<section hydrate:load>`). Boundary comment markers wrap the directive host element in document order; the directive attribute is omitted from serialized HTML.

**Prototype style delivery**: SFC `<style>` blocks are emitted as a `<style>` element in `<head>` (block body copied verbatim; `scoped` attribute not serialized). Template nodes may also carry `style=""` attributes when the SFC template specifies inline styles. Per-component CSS asset files and `<link rel="stylesheet">` for route styles are deferred past the prototype slice; manifest `assets.css` may be absent or client-only for the shared client entry bundle.

**Prototype contract cutover**: Golden SSR/manifest contracts and compiler output change in the same change set (no long-lived red goldens on main).

**Prototype M11 sequence**: Exit requires two polish passes before post-prototype work — (1) **thin M11** (done): hydrate honors `luxel-hydration` boundaries and boundary host DOM; sync `docs/prototype-slice.md` with inline-style policy; hardening tests for escape and impure expressions. (2) **fat M11** (done): `compileCounterApp` discovers file routes (`index`, `about`); `GET /about` serves SSR; streaming spike via `?stream=1` and `streamHtmlDocument` (chunked `ReadableStream`, byte-identical to buffered HTML).

**Prototype SFC syntax**: Template expressions use `{expr}`. Event bindings use `on:event={handler}`. Colon-directive family matches `hydrate:*` (`hydrate:load`, `on:click`).

**Prototype template purity**: Strict whitelist for template expressions: literals, identifiers, and member access only. Operators and function calls are deferred past prototype slice.

**Prototype dev reload policy**: File watch invalidates route/component graph nodes, rebuilds affected output, then triggers full page reload. Fine-grained HMR is deferred.

**Prototype benchmark**: One runnable Luxel micro benchmark for the counter route: SSR throughput and generated client JS size. Competitor comparisons and weighted scorecard are deferred.

**Prototype package layout**: Hybrid Bun workspace with `packages/luxel` for compiler/runtime/dev/CLI internals, `packages/bench` for runnable benchmark code, and `examples/counter` as the demo app. Finer `@luxel/*` package split is deferred.

**Prototype routing**: File routes only. The prototype route lives at `examples/counter/src/routes/index.luxel` and generates the route manifest. Code routes are deferred.

**Prototype compiler ownership**: Use Bun build APIs first for bundling and build orchestration. Use Oxc only as a compiler front-end where Bun cannot expose framework semantics, especially `<script>` analysis. If Oxc blocks the prototype, fall back to a custom parser.

**Prototype parser fallback trigger**: Switch from Oxc to a custom parser if Oxc cannot expose import/export/`load()`/binding data cleanly or if Oxc adds install/build friction on Windows/Bun.

**Prototype signal runtime**: Luxel ships its own tiny signal runtime for `signal`, `computed`, and `effect` during the prototype slice.

**Prototype DOM update strategy**: Compiler emits direct text, attribute, and event attach ops with no VDOM. Minimal hydration markers provide stable anchors only where needed.

**Prototype codegen policy**: Render IR lowers the SFC template to a linear DOM op list; codegen walks ops for SSR HTML and the client attach module. The `<script>` block is bundled verbatim (Bun); the compiler does not parse signal graphs in the prototype slice.

**Prototype compile API**: `compileRoute(sfc)` is the single compile entry used by dev, build, test server, and Render worker. It returns server module source, client route module source, attach module source, and manifest slice; writing files under `dist/` is a thin `writeFile` step in build.

**Prototype client glue**: For each route, Luxel extracts the SFC `<script>` verbatim and appends generated `setupBoundary` glue that imports the generated attach module and wires handler/state symbols from the same module scope. Authors do not hand-write `client/routes/index.js` for file routes in the prototype slice.

**Prototype data sidecar**: SSR embeds route data in an inert JSON script (`type="application/json"`) for hydration. No executable JS literals.

**Prototype escaping policy**: HTML escaping is default for all template interpolation. `unsafe:html` is forbidden during the prototype slice.

**Prototype render worker**: Luxel exposes a Render worker abstraction during the prototype slice, but the implementation runs in the same Bun process. Worker IPC and pools are deferred.

**Prototype CLI**: Thin `luxel dev`, `luxel build`, and `luxel bench` commands drive the prototype dev loop, production build, and benchmark run.

**Prototype build output**: `luxel build` emits a server entry, client assets, and generated manifest. Single compiled Bun binary and platform adapters are deferred.

**Prototype test scope**: Tiny Bun unit tests, route integration tests, and one Playwright smoke test that clicks the counter and verifies browser hydration.

**Prototype plan**: Executable implementation checklist in `docs/prototype-slice.md`; separate from the compact architecture overview in `docs/architecture.md`.

**Prototype implementation order**: Test-first vertical tracer: write fixture behavior tests, hardcode generated SSR/client output, then replace hardcoded output with compiler-generated IR and build plumbing.

**Prototype artifacts**: Public build contracts are `manifest.json`, buffered SSR document with JSON sidecars (`luxel-data`, `luxel-hydration`), generated client attach module, and server route module exports (`load`, `render`). Private IR stays internal.

**Prototype app config**: Minimal `luxel.config.ts` per app with `root`, `routesDir`, and `outDir`. Generated manifest remains separate from app config.

**Prototype milestones**: M0–M11 phased plan in `docs/prototype-slice.md`; tracer first (M2), runtime/worker next (M3–M4), compiler/manifest replace tracer (M5–M7), CLI/bench last (M8–M11).

**Post-prototype roadmap**: Work after the prototype slice exits (M11 green). Covers auth, ISR, trisomorphic service worker, plugins, worker pools, platform adapters, and expanded threat-model docs — not part of the prototype slice.

**Horizon C (architecture §12):** After phase-1 exit (A) and phase-B deploy exit (B): **(C1)** `docs/threat-model.md` outline — **surface tables** (rows per surface: SFC compile, SSR HTML, `luxel-data` v2, client nav, deploy/compression, server-fn stub; columns: threat, mitigation pointer, status); **(C2)** benchmark harness skeleton — `fixtures/micro/{counter,list,table}` registry; only **counter** runner wired; `luxel bench` prints **JSON lines** (`fixture`, `metric`, `value`); list/table entries `pending`; competitor scorecard weights deferred; **(C3)** phase-2 trisomorphic SW on nav-demo (HTML cache + adaptive nav per **Post-prototype phase 2**); **(C4+)** remaining §12 #4 (ISR, auth, plugins, per-route offline) and **(C5)** docs site — not before C1–C2.

**Post-prototype phase 1 (ADR):** See [docs/adr/0001-resource-store-phase-1.md](./docs/adr/0001-resource-store-phase-1.md).

**Compiler/server deepening (ADR):** See [docs/adr/0004-compiler-server-deepening.md](./docs/adr/0004-compiler-server-deepening.md).

**luxel-core phased rollout (ADR):** See [docs/adr/0005-luxel-core-phased-rollout.md](./docs/adr/0005-luxel-core-phased-rollout.md).

**Post-prototype phase 1**: **Resource store** — cache-aware async data with HTTP semantics, stable keys, and tags on **server render and client navigation** (no service worker yet). **Phase-1 exit gate:** `luxel-data` v2 envelope + template binding map in manifest + `void` `load`/`prefetch` + server pipeline `prefetch` → `load` → render-from-store + client nav on `examples/nav-demo` (Playwright `/`↔`/detail`, `data-luxel-nav`) + counter fixture migrated + contract goldens updated in the same cutover PR. Compiler-inferred default keys from `store.set` analysis may follow immediately after exit but are not required for exit. **Post-prototype phase 2**: **Trisomorphic SW** — service worker caches **full HTML documents** keyed by route plus resource generation/etag; cache hit serves stored HTML, miss falls back to network SSR. Uses the same resource keys/tags as phase 1; does not re-run Render IR in the worker at phase-2 entry. **Phase-2 entry slice (C3):** prove on **`examples/nav-demo`** — SW install precaches `/` and `/detail` HTML; `fetch` serves cache when the key matches route + resource generation from the cached `luxel-data` v2 snapshot; **adaptive navigation:** first visit = normal document load (MPA/SSR); after SW is active, in-app navigations prefer SW-cached HTML when valid, else **document fallback** to network SSR (not a separate JSON nav protocol). Per-route `offline:` exports (`none | static | stale | custom`) deferred until after this slice is green.

**Resource load pipeline**: Route `load()` and `prefetch()` **only write** the resource store (`void` return — no view-model object). **Render** reads the store (never `load` return values). If SSR needs a flat binding map, the framework **projects** store entries into template data at render time; authors do not return that map from `load`. Hydration receives a versioned **resource snapshot** in the existing `luxel-data` sidecar (`id` unchanged). **v2 envelope:** `{ "version": 2, "resources": <ResourceSnapshot> }` only — no duplicate flat `bindings` in JSON. SSR and client hydrate **project** template data from `resources` + the route **template binding map** in the manifest. v1 flat objects are removed on phase-1 contract cutover (counter + nav-demo migrate together). Still inert JSON, no executable literals.

**Template binding map**: Generated manifest slice mapping each template identifier (e.g. `headline` in `{headline}`) to a resource store stable key and optional field path. Render and hydrate **project** flat template data from the store using this map — authors do not return that map from `load`.

**Resource stable keys**: Compiler assigns default stable keys from route id and analyzed `load`/`prefetch` writes; authors may override keys (and tags) explicitly when needed for deduplication or invalidation. Binding-map entries reference these keys.

**Resource cache entry**: Each stored resource carries HTTP-style cache metadata (for example `max-age`, stale/revalidate windows) **and** tag membership for grouped invalidation (`revalidateTag` / equivalent).

**Resource store fixture**: Post-prototype phase 1 is proven by a new two-route demo app (for example `examples/nav-demo`) with client navigation, `prefetch`, and tag revalidation — not by extending the counter prototype fixture alone.

**Client navigation (phase 1)**: In-app route changes `fetch` the target URL as a full HTML document, parse `luxel-data` / `luxel-hydration` from the response, merge into the client resource store, and re-hydrate affected boundaries — no separate JSON nav protocol in phase 1. **Client store merge:** upsert by stable resource key; an incoming entry replaces the local entry when its `generation` is greater than or equal to the local generation (ties favor the server snapshot from the latest navigation). **Nav trigger:** opt-in only — internal links carry `data-luxel-nav` (future `<Link>` may set it); a single delegated click handler in the client entry performs fetch+swap. Links without the attribute use normal browser navigation. **DOM update:** `DOMParser` → replace current `<main data-luxel-route="…">` from the response → `history.pushState` → project v2 resources + binding map → re-hydrate affected boundaries (no full reload on forward nav). **Back/forward:** `popstate` triggers a **full document navigation** in phase 1; client-managed history back is deferred.

**Route prefetch**: Optional `export async function prefetch(ctx)` lives in the route SFC `<script>` alongside `load()`; it writes to the resource store ahead of navigation or SSR. **Phase-1 exit:** `prefetch` runs on the **server only** (SSR pipeline: `prefetch` → `load` → render); compiler recognizes the export. Client hover/background prefetch and dedicated prefetch endpoints are deferred.

**Tag revalidation**: `revalidateTag(tag)` (or equivalent) is a **server-only** API in phase 1 — callable from route loaders, prefetch, and (later) server functions after mutations. Client navigation reads the resource store and sidecar snapshots; it does not invalidate tags in phase 1.

**Response compression middleware**: Optional Luxel server layer wrapping the app `fetch` handler. Negotiates `Accept-Encoding`, sets `Content-Encoding` on eligible bodies. Luxel-owned — not CDN-only. See [docs/adr/0002-response-compression.md](./docs/adr/0002-response-compression.md).

**Compressible response policy**: Compress bodies whose MIME is text-like or structured text (`text/*`, `application/javascript`, `application/json`, `application/manifest+json`, …). Denylist already-compressed binary types (`image/*`, `video/*`, `font/woff2`, …). Pick best mutual codec per request — never encode a format the client did not offer.

**Streaming compression policy**: v1 skips compression when the response body is a `ReadableStream` (including `?stream=1` SSR). Buffered responses compress normally. Streaming `TransformStream` compression is a later enhancement.

**Compression codec preference**: Middleware picks the first mutual `Content-Encoding` from a configurable ordered list. Default order: `zstd`, then `br`, then `gzip`, then `deflate`. Honor `Accept-Encoding` quality values (`;q=`) when clients send them.

**Compression size floor**: Skip encoding when the uncompressed body is below a configurable byte threshold. Default floor: 1024 bytes.

**Dev compression default**: `luxel dev` and local test servers leave response compression **off** unless authors enable it in app config or server options. Production deploy entry enables compression by default.

**Compression cache variance**: When middleware sets `Content-Encoding`, merge `Accept-Encoding` into the response `Vary` header (dedupe tokens). Skip `Vary` changes when the body stays identity.

**Static precompression policy**: v1 compresses eligible responses at request time in middleware only. Build-time `.br` / `.zst` / `.gz` sidecars for immutable `/assets/*` are deferred until `luxel build` owns long-cache static output.

**Compression implementation policy**: Single encoder module, runtime-selected: **Bun** → `Bun.*Sync` (incl. zstd); **Node/Deno deploy** → `node:zlib` for gzip, deflate, br, and **zstd when `zstdCompressSync` exists** (Node ≥22.15). No npm codec dep for phase B. If a negotiated codec has no encoder on this runtime (e.g. zstd on Node 20–22.14), **skip that codec** and pick the next mutual one — never throw mid-request. Optional npm backends remain a post-v1 / ADR-0002 follow-up for exotic overrides.

**Compression configuration surface**: Production defaults live in `luxel.config.ts` under `server.compress`. Tests and custom servers pass the same typed `CompressOptions` to `wrapCompress(fetch, opts)` from `@luxel/luxel/server`. Programmatic options override config file values.

**Compression passthrough rules**: Middleware leaves the response identity when `Content-Encoding` is already set, MIME is not compressible (allow/deny policy), the request method is `HEAD`, or the status is 1xx, 204, or 304.

**Compression v1 slice**: Shipped — `wrapCompress`, `CompressOptions`, `createAppServerFetch`, `luxel.config` `server.compress`, prod `server/entry.js` with `productionCompress`. Defers npm fallbacks, stream compression, and build-time asset sidecars. Tracked on GitHub **#27**. See [docs/adr/0002-response-compression.md](./docs/adr/0002-response-compression.md).

**Runtime support policy**: Pre-v1 (**phase B**): production server runs on **Node** and **Deno**; `luxel build` / `luxel dev` / `luxel bench` / framework tests stay **Bun-only**. **v1.0** keeps the **Bun-only author toolchain** (authors still use `luxel build` / `dev` / `bench` on Bun). **v1.1** adds full toolchain parity on Node and Deno (ADR-0003 phase A), developed at **same priority** as v1.0 exit work. Deploy contract remains Web `fetch` (`createAppServerFetch`); runtime-specific listen glue is adapter layer, not a second app model. See [docs/adr/0003-multi-runtime-deploy.md](./docs/adr/0003-multi-runtime-deploy.md).

**v1.0 release scope (horizon D):** App framework complete for authors — SSG/ISR production paths, hardened server functions, auth + DB primitives, trisomorphic SW with per-route offline policies, docs site dogfooding Luxel, benchmark scorecard published, semver + stability matrix + migrations. **Not in v1.0:** edge adapters; plugin WASM sandbox (v1.1); Bun/Node/Deno **toolchain** parity (v1.1). **Deploy:** Node/Deno production server remains in scope for v1.0 (phase B).

**SSG (C4a):** `luxel build` pre-renders eligible routes to static HTML under `dist/static/` (CDN-friendly); production handler serves those files before invoking the render worker. Lazy first-request SSG is out of scope for C4a. **Static route selection:** hybrid — compiler infers `prerender` when `load`/`prefetch` analysis shows no cookies, headers, or session reads; authors override with `export const prerender = true | false` in the route SFC `<script>`.

**ISR (C4b):** Rendered HTML cache via **pluggable adapter interface** with a **filesystem adapter** shipped for v1.0 (e.g. `.luxel/cache/html/` + metadata beside `dist/`). A **Redis/KV adapter** may exist as a non-required stub or follow-up; not a v1.0 exit gate. **Invalidation:** hybrid — route `export const revalidate = <seconds>` in the SFC `<script>` (manifest-recorded TTL) **and** regeneration when tagged resources in the resource store are stale (`revalidateTag` / generation), same keys as phase-1 store semantics.

**Auth sessions (C4c):** Opaque session cookie → **session store adapter interface** with a **SQLite file** adapter shipped for v1.0 (dev and small deploy). **Postgres session adapter** (`@luxel/db-postgres` or equivalent) ships **after v1.0** — not an auth exit gate. JWT remains non-default.

**Auth providers (C4c):** **Provider adapter interface** + **one reference provider** (e.g. dev credentials or email/password stub) for tests and docs at v1.0. **OAuth providers** (e.g. Google, GitHub) ship **after v1.0** — not an auth exit gate.

**Benchmark scorecard (C4g):** v1.0 exit requires the **full architecture §11 comparison matrix** on shared fixtures (micro + app class): Luxel, React, Vue/Vapor, Solid, Svelte, and Fastify where applicable. Per-metric results published; weighted scorecard formula may ship with documented weights. C2 skeleton only defers competitor **runners** until harness exists — v1.0 must wire them.

**Docs site (C4f):** First-class Luxel app at **`examples/docs-site/`** in the Bun workspace — dogfoods build, SSR/SSG/ISR, auth, server fns, and deploy; also a benchmark **app** fixture per architecture §11.

**Offline policy (C4e):** Per-route `offline: none | static | stale | custom` on trisomorphic SW — **hybrid** selection: compiler infers defaults (`static` for SSG/prerender, `stale` for ISR/`revalidate`, `none` for dynamic SSR); authors override with `export const offline = "…"` in the route SFC `<script>`.

**Server functions (C4d):** Compile-time manifest IDs only; schema validation; **HTML forms and JSON RPC** share one ID namespace at v1.0. Payload types restricted to JSON / structured-clone-safe values (no executable literals). **CSRF:** validate `Origin`/`Referer` on mutations plus a **session-bound CSRF token** — hidden form field for HTML posts, `X-Luxel-CSRF` header for JSON RPC; token surfaced via SSR meta or inline config for client callers.

**v1.0 feature order (after C3 SW):** **(C4a)** SSG → **(C4b)** ISR (`revalidate`, tag integration with resource store, render worker cache adapters) → **(C4c)** auth + DB primitives (session cookie, provider adapters, SQLite session store) → **(C4d)** hardened server functions (manifest IDs, schema validation, CSRF/origin/session; **forms + JSON RPC** both v1.0, one manifest ID space) → **(C4e)** per-route `offline:` policies on trisomorphic SW → **(C4f)** docs site (`examples/docs-site` Luxel app in monorepo) → **(C4g)** benchmark scorecard published (full §11 competitor matrix) → **(C4h)** semver + stability matrix + migrations → **v1.0 tag**.

**Stability matrix (C4h):** **Strict** semver surface at v1.0 — **frozen diagnostic codes**, **versioned manifest schema**, and documented **public API** (`luxel` CLI, generated manifest contract, published `@luxel/luxel` server/deploy subpaths). Breaking compiler output or manifest shape only in **major** releases, with **codemods** noted in the matrix. Migrations doc required for each major.

**Deploy integration**: **Handler-first** — apps wire `createAppServerFetch({ app, clientBundle, … })` to any HTTP server. **Runtime adapters** (`@luxel/luxel/node`, `@luxel/luxel/deno`, or package subpaths) are thin listen glue only (`serveLuxel({ …, port })` → same fetch). One shared `dist/` (ESM); no separate Deno emit pre-v1.

**Deploy artifact loading**: `luxel build` (Bun) emits a **bundled** `dist/server/app.mjs` with resolved deps plus existing assets/manifest. Framework exposes **`loadAppFromDist(distDir)`** → `{ app, clientBundle }` for `createAppServerFetch` and adapters. Raw `dist/server/routes/*.ts` remain inspectable/debug emit, not the Node/Deno entry path. **ESM-only** pre-v1; **Node 20+** and **Deno 2+**.

**Node deploy floor**: **Node 20+** LTS (unchanged). **zstd** on Node only when `node:zlib` exposes `zstdCompressSync` (≥22.15); older 20.x/22.14 negotiate br → gzip → deflate only. Document in deploy matrix; no npm zstd fallback in phase B.

**Runtime adapter packaging**: Phase B ships Node/Deno listen glue as **`@luxel/luxel` package subpaths** (e.g. `@luxel/luxel/node`, `@luxel/luxel/deno`, and a deploy subpath for `loadAppFromDist` + server exports). Separate `@luxel/node` / `@luxel/deno` packages deferred unless adapters outgrow one package at v1.

**Phase B implementation order**: (1) runtime compression encoders, (2) `loadAppFromDist` + `dist/server/app.mjs` bundle in `luxel build`, (3) `@luxel/luxel/node` and `/deno` adapters, (4) Node integration test against built `dist/`. See [docs/adr/0003-multi-runtime-deploy.md](./docs/adr/0003-multi-runtime-deploy.md).

**Phase B exit gate:** deploy matrix doc current; `luxel build` → `start-node.mjs` / `start-deno.mjs` smoke **counter + nav-demo** (nav-demo asserts `luxel-data` v2 after phase-1). **CI must run Deno deploy tests** (Deno installed in workflow; no permanent `skipIf(!deno)` escape hatch on the main integration path).

**Prototype threat model**: Inline threat table in `docs/prototype-slice.md` for prototype scope; full `docs/threat-model.md` deferred until after slice.

_Avoid_: "framework" as product name in docs (use **Luxel**); "server components" in React sense; "hydration" alone when meaning progressive boundary hydration.

## Relationships

- A **Route** has zero or one **Route loader** and zero or one **Prefetch**
- **Prefetch** → populates request **Resource store** → **Render worker** consumes it
- **SFC** compiles to SSR stream + client bundle + optional **Hydration boundary** metadata
- **Server function** never references arbitrary modules from the client — only manifest IDs
- **Trisomorphic rendering**: initial nav → server; repeat nav → SW if cache hit, else server fallback
- **Prototype slice** proves the compile → render → hydrate → benchmark path before larger subsystems
- **Prototype fixture** exercises `load()`, signal reactivity, event binding, scoped CSS, SSR, and progressive boundary hydration
- **Prototype IR** keeps compiler internals private while proving SFC validation, SSR generation, client attach, and boundary metadata
- **Prototype hydration policy** uses explicit element-attribute boundaries to validate manifest + client attach before compiler heuristics
- **Prototype boundary SSR** keeps hydrate directive hosts in SSR output and uses comment markers on those hosts
- **Prototype style delivery** uses head `<style>` for SFC blocks and optional `style=""` on template nodes; no per-route CSS files in the prototype slice
- **Prototype SFC syntax** keeps expressions and events in one colon-directive vocabulary with `hydrate:*`
- **Prototype template purity** enforces compile-time pure expressions before broader macro/escape-hatch work
- **Prototype dev reload policy** proves Luxel's Vite-free graph ownership before adding fine-grained HMR
- **Prototype benchmark** proves measurement plumbing early without turning benchmark breadth into the prototype bottleneck
- **Prototype package layout** keeps one framework package, one benchmark package, and one demo app under Bun workspaces
- **Prototype routing** proves file route discovery and manifest generation from `examples/counter` before adding code routes
- **Prototype compiler ownership** keeps Bun responsible for build/bundle work while Luxel owns SFC semantics
- **Prototype parser fallback trigger** prevents parser tooling from blocking the compile → render → hydrate path
- **Prototype signal runtime** establishes Luxel-owned fine-grained reactivity before broader runtime features
- **Prototype DOM update strategy** ties fine-grained signals directly to generated DOM attach/update ops
- **Prototype codegen policy** generates SSR and attach from a template DOM op list while leaving `<script>` to Bun bundling
- **Prototype compile API** keeps one compile pipeline for dev, build, tests, and Render worker; dist output is emitted from that pipeline
- **Prototype client glue** appends boundary setup exports to the extracted SFC script before client bundling
- **Prototype data sidecar** exercises JSON-only hydration data without introducing server-component-style executable payloads
- **Prototype escaping policy** proves safe rendering defaults before adding explicit unsafe escape hatches
- **Prototype render worker** preserves the SSR isolation boundary in code shape before adding worker pools and IPC
- **Prototype CLI** makes the prototype executable through the public `luxel` command shape from day one
- **Prototype build output** proves the deploy artifact shape before adapter and binary packaging work
- **Prototype test scope** verifies compiler/runtime units, route SSR integration, and real browser progressive boundary hydration
- **Prototype plan** translates architecture decisions into build order without expanding the architecture overview
- **Prototype implementation order** proves end-to-end behavior before deepening compiler/runtime internals
- **Prototype artifacts** define inspectable public outputs separate from private compiler IR
- **Prototype app config** points Luxel at `examples/counter` without expanding config beyond path roots
- **Prototype milestones** sequence tracer, runtime, compiler, build, dev, bench, and smoke validation
- **Prototype M11 sequence** requires thin then fat polish before post-prototype roadmap work begins
- **Post-prototype roadmap** starts only after prototype slice exit; defers auth, ISR, trisomorphic SW, and plugins
- **Post-prototype phase 1** delivers the resource store on server + client nav before SW (phase 2)
- **Post-prototype phase 2** adds service worker HTML document caching keyed by route and resource staleness
- **Resource load pipeline** routes `load`/`prefetch` through the store into a versioned `luxel-data` resource snapshot
- **Resource stable keys** default from the compiler with optional author overrides
- **Resource cache entry** combines HTTP cache metadata with tags on every stored resource
- **Resource store fixture** validates phase 1 via a dedicated two-route demo app
- **Client navigation (phase 1)** uses full-document fetch plus sidecar parse and store merge
- **Route prefetch** is authored as an optional SFC script export next to `load()`
- **Tag revalidation** is server-only in phase 1; clients consume invalidated snapshots via subsequent HTML nav
- **Response compression middleware** wraps app `fetch` for encode-on-wire; reverse proxies may still compress independently
- **Compressible response policy** applies MIME allow/deny rules; browsers transparently decode negotiated `Content-Encoding`
- **Streaming compression policy** defers compressing stream bodies until after buffered-path middleware is proven
- **Compression codec preference** is author-configurable with zstd-first defaults and `Accept-Encoding` q-value respect
- **Compression size floor** avoids compressing tiny error or stub responses unless authors lower the threshold
- **Dev compression default** keeps local iteration fast; production server wiring turns compression on unless disabled
- **Compression cache variance** keeps shared caches safe across negotiated encodings without dropping other `Vary` tokens
- **Static precompression policy** separates v1 dynamic middleware from later build-emitted asset sidecars
- **Compression implementation policy** uses Bun encoders on Bun and `node:zlib` on Node/Deno deploy, with capability-based zstd and no npm dep in phase B
- **Compression configuration surface** unifies `luxel.config.ts` defaults and `wrapCompress` overrides behind one typed options object
- **Compression passthrough rules** prevent double-encoding and skip bodyless or non-entity responses
- **Compression v1 slice** waits until after **Post-prototype phase 1** resource store, then ships via a dedicated issue
- **Runtime support policy** separates pre-v1 deploy runtimes (Node, Deno) from Bun-only toolchain until v1 parity
- **Deploy integration** keeps `createAppServerFetch` as the contract; Node/Deno adapters only bind fetch to a listener
- **Deploy artifact loading** pairs a Bun-built server bundle with `loadAppFromDist` so deploy runtimes never import monorepo-relative route sources
- **Node deploy floor** keeps Node 20+ while zstd stays capability-gated on newer Node patch releases
- **Runtime adapter packaging** colocates deploy adapters as subpath exports on the main framework package pre-v1
- **Phase B implementation order** ships encoders before bundle/loader, then adapters, then Node integration tests
- **Prototype threat model** records XSS, JSON sidecar, purity, and manifest threats without blocking tracer work

## Example dialogue

> **Dev:** "Should this page SSR?"
> **Expert:** "If `load` reads cookies → SSR. Static catalog only → SSG. `revalidate: 60` → ISR. Override in route export if auto mode wrong."

## Flagged ambiguities

- **C2 vs C4g:** Horizon C2 ships counter-only JSON lines; **v1.0 (C4g)** still requires the full competitor matrix — plan runner work between C2 and v1.0 tag.
- "Resumability" (Qwik-style) is **not** v1 — streaming + progressive hydration yes; full resumability deferred.
- "Vite-free" = no Vite, Rollup, or Vite plugin API — Bun.build + Oxc analysis + own dev/HMR graph.
