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

v1 **phase A** adds Bun/Node/Deno parity for dev, build, bench, and framework tests. See [ADR-0003](./adr/0003-multi-runtime-deploy.md).

## Local production smoke

From an app directory (e.g. `examples/counter`) after `luxel build`:

```bash
node dist/server/start-node.mjs
```

```bash
deno run --allow-net --allow-read --allow-env dist/server/start-deno.mjs
```

Or npm scripts: `pnpm start:node` / `pnpm start:deno` when defined in the example app.

Optional env: `PORT`, `HOST`, `LUXEL_COMPRESS=0` (disable compression), `LUXEL_DIST_DIR` (defaults to parent of `dist/server/`).
