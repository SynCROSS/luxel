# Toolchain host (v1.1)

**v1.0 author toolchain:** Bun only — `bun packages/luxel/src/cli.ts` or `luxel` when installed via Bun workspaces.

**v1.1 exit:** Native host on **Node and Deno together** — `luxel dev` / `build` / `bench` with **no Bun on PATH**. Work starts in the **v1.0 implementation cycle**. First **v1.1-rc** when **both** hosts pass CI.

**Rejected:** `luxel-host.mjs` Bun-spawn bridge — removed. No subprocess fallback to Bun on Node/Deno.

## Native entries (v1.1)

| Runtime | Entry | Status |
|---------|--------|--------|
| Node | `packages/luxel/bin/luxel-node.mjs` | `dev` / `build` / `bench` / `serve` via esbuild; publish ships `dist/host/run.mjs` (`prepublishOnly`); monorepo dev self-bundles to `.cache` when prebuilt absent |
| Deno | `packages/luxel/bin/luxel-deno.ts` | `dev` / `build` / `bench` / `serve` via esbuild backend (`--allow-run` for `serve`; `--allow-sys` when INP bench enabled) |
| Bun (v1.0) | `packages/luxel/src/cli.ts` | Shipped |

## Compile backend (locked)

1. **v1.1-rc:** **esbuild** bundles + Luxel-owned SFC compiler (private IR unchanged).
2. **Later:** **WASM** compiler core — same CLI/API, swap backend without breaking authors.

See `packages/luxel/src/host/backends/`.

## Config (`luxel.config.ts`)

Node without Bun: `loadLuxelConfig` tries native `import()` first; on `.ts` loader errors (Node 20+), esbuild bundles config to a temp `.mjs` then imports. No Bun required.

## Deploy (v1.0)

Production **server** on Node/Deno uses `createAppServerFetch` + `dist/` — not the author toolchain. See [deploy-matrix.md](./deploy-matrix.md).
