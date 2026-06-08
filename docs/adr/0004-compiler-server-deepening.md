# Compiler and server deepening

**Status:** accepted

Luxel prototype + phase-1 features grew `compile-route.ts`, `handler.ts`, CLI/native-host duplication, and a split benchmark harness. This ADR locks deepening seams from the architecture review (waves A–F).

## Decision

1. **Route analysis** — Single `analyzeRouteSfc` artifact per SFC: template IR (one `parseSfc`), **script analysis** (modes, bindings inputs, exports), client flags. `compileRoute` orchestrates only.

2. **Template IR** — Merge semantic + render lowering into `compileTemplateIr` (one parse). Keep `compileSemanticIr` / `lowerToRenderIr` as thin re-exports until callers migrate.

3. **Script analysis** — `analyzeScript(script)` replaces scattered regex in `compile-route.ts`. `infer-bindings.ts` / `infer-static-load.ts` remain binding/static helpers fed by analysis.

4. **Route runtime parity** — Bundled `server.mjs` exports `renderRouteDocumentFromStore`. Dev `CompiledRoute.renderFromStore` delegates to the same bundled export (not a parallel closure). Static precompute embeds snapshot equality in generated server module, not dev-only closures.

5. **Request resolution pipeline** — `createAppFetch` runs ordered **fetch stages** (auth → server-fn → internal → SW → assets → page strategies → render). `wrapCompress` stays outer ([ADR-0002](./0002-response-compression.md)).

6. **Host runtime** — `HostContext` + `dispatchHostCommand` shared by `cli.ts` and `native-host.ts`. Replaces duplicated `findRepoRoot` / bench loops. `setLuxelPkgSrc` global retained for bundled hosts but set via `HostContext`.

7. **Bench fixture seam** — Public `@luxel/luxel/bench` exports `createBenchServer` / test-server helpers. WinRK and external harness import package exports, not `packages/luxel/src/test/*` relative paths.

8. **Dev graph** — Delete unused `DevGraph` until incremental `compileApp({ routeIds })` exists ([CONTEXT.md](../../CONTEXT.md) post-v1.0).

9. **Pass-through cleanup** — Remove `route/compile-counter.ts`, drop `generateCounterManifest` from public package exports.

## Implementation order

| Wave | Scope |
|------|--------|
| A | Script analysis, template IR merge, pass-through cleanup |
| B | Route compile split, deploy parity test |
| C | Handler fetch stages |
| D | Host runtime |
| E | Bench public API + WinRK |
| F | DevGraph deletion |

## Considered options

| Topic | Rejected | Why |
|-------|----------|-----|
| Oxc script AST now | Block compile split on Oxc | Prototype regex sufficient; Oxc is fallback trigger per CONTEXT |
| Separate `@luxel/bench` package move | Fold bench into luxel only | Keep `packages/bench` for WinRK/competitors; seam is export surface |
| Keep DevGraph | Wire invalidation to full rebuild | Graph adds false depth; full rebuild unchanged |
| Handler one file | Leave `handler.ts` monolith | Stage tests need seams before C4 auth/server-fn growth |

## Consequences

- `deploy.test.ts` gains parity assertion: test-server HTML === `loadAppFromDist` HTML (contract subset).
- `codegen-client-glue` reads handler symbols from render bind points — no hardcoded `{ count, increment }`.
- Root `CONTEXT.md` gains: Route analysis, Route runtime module, Request resolution pipeline, Bench fixture contract.
- Aligns [ADR-0003](./0003-multi-runtime-deploy.md): deploy imports bundled route modules; no second render impl in dev closures.

## Related

- Root `CONTEXT.md`
- `packages/luxel/src/compiler/compile-route.ts`
- `packages/luxel/src/server/handler.ts`
- `packages/luxel/src/host/native-host.ts`
