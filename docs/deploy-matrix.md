# Deploy matrix (phase B)

| Capability | Bun toolchain (`luxel build` / `dev` / `bench`) | Node deploy (20+) | Deno deploy (2+) |
|------------|-----------------------------------------------|-------------------|------------------|
| SSR + assets | Yes | Yes | Yes |
| `loadAppFromDist` | N/A (in-process compile) | Yes | Yes |
| Response compression | Yes (`Bun.*Sync`) | Yes (`node:zlib`) | Yes (`node:zlib` via compat) |
| zstd negotiation | Yes | Yes when `zstdCompressSync` exists (Node **≥22.15**) | Same as Node column |
| Node 20–22.14 deploy | N/A | br → gzip → deflate (zstd skipped) | Same |
| Edge / Workers | No | No | No |
| Full toolchain on host | Yes (pre-v1) | Deploy only | Deploy only |
| v1.1 native host (`luxel-node.mjs` / `luxel-deno.ts`, no Bun) | Yes (rc) | Yes — `dev` / `build` / `bench` / `serve` | Yes — `dev` / `build` / `bench` / `serve` |

**v1.0** tag: app + perf + package-manager gates; author toolchain Bun-only; Node/Deno **deploy**. **v1.1** tag: native host (`luxel-node` / `luxel-deno`, esbuild backend) on Node/Deno (no Bun on PATH). Host work runs in parallel with v1.0; see [ADR-0003](./adr/0003-multi-runtime-deploy.md).

## Package managers (v1.0 exit)

| Manager | Install | Notes |
|---------|---------|--------|
| npm | `npm install` | npm workspaces (`package.json`) |
| pnpm | `pnpm install` | `pnpm-workspace.yaml` |
| yarn | `yarn install` | Corepack Yarn 4+; `package.json` workspaces |
| bun | `bun install` | `bun.lock` |

CI matrix on main must pass **install → `luxel build` (counter) → `bun test packages/luxel/test`** for all four. Toolchain still invokes Bun for `luxel` CLI through v1.0; only **dependency install** is manager-specific.

## Local production smoke

From an app directory (e.g. `examples/counter`) after `luxel build`:

```bash
luxel serve node
luxel serve deno
```

`luxel serve deno` finds Deno in `%USERPROFILE%\.deno\bin` when it is not on PATH (common on Windows).

Direct starters (if `deno` / `node` are on PATH):

```bash
node dist/server/start-node.mjs
deno run --allow-net --allow-read --allow-env dist/server/start-deno.mjs
```

Or: `bun run start:node` / `bun run start:deno` in `examples/counter`.

Optional env: `PORT`, `HOST`, `LUXEL_COMPRESS=0` (disable compression), `LUXEL_DIST_DIR` (defaults to parent of `dist/server/`).
