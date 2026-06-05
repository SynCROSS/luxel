# Stability matrix (v1.0 draft)

Public API and semver rules for Luxel **pre-1.0** roadmap. Maintainer sign-off required before first major tag (see slice C4h).

## Semver

| Change | Bump |
|--------|------|
| Breaking manifest schema, diagnostic code removal, CLI flag removal | **major** |
| New route modes, optional manifest fields, new metrics in bench JSON lines | **minor** |
| Bug fixes, docs, performance | **patch** |

## Public surface (frozen list — draft)

| Surface | Location |
|---------|----------|
| `luxel dev` / `build` / `bench` / `serve` | `packages/luxel/src/cli.ts` |
| `createAppFetch` / `createAppServerFetch` | `packages/luxel/src/server/handler.ts` |
| `loadAppFromDist` | `packages/luxel/src/deploy/load-app.ts` |
| `serveLuxel` (Node/Deno) | `packages/luxel/src/node/serve.ts`, `deno/serve.ts` |
| Manifest `version` + route `mode` | `packages/luxel/src/manifest/types.ts` |
| `luxel-data` v2 sidecar | `packages/luxel/src/resource-store/luxel-data.ts` |
| Bench JSON line shape | `packages/luxel/src/bench/registry.ts` |

## Manifest schema

- Current **`manifest.version`**: `2` (enforced in contract tests).
- Route **`mode`**: `ssr` | `ssg` (ISR adds `isr` in a future minor).

## Diagnostics

Compiler errors use stable `LUXEL_*` codes (see `packages/luxel/src/compiler/`). Renumbering or removing codes is **major**.

## Migrations

Each **major** release notes required codemods in `docs/migrations/vX.md` (template only until v1.0 tag).
