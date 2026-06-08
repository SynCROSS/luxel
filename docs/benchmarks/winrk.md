# WinRK benchmark guide (Windows)

[winrk](https://github.com/fomalhaut88/winrk) = wrk-like HTTP load tool for Windows.

## winrk flags

```text
winrk -t8 -c400 -d15 http://127.0.0.1:3000
```

| Flag | Meaning | Recommended |
|------|---------|-------------|
| `-t` | threads | `8` |
| `-c` | concurrent connections | `400` |
| `-d` | duration **seconds** (number only) | `15` |

**Not valid:** `-d15s` — duration must be a float, no `s` suffix.

Output line to read: `rps: N requests per sec`.

## Automated run (all stacks)

From repo root:

```powershell
# build CSR competitor dists (once)
bun run --cwd packages/bench bench:competitors:build

# counter stacks (default) -> docs/benchmarks/runs/winrk-latest.{json,md,jsonl}
$env:WINRK_THREADS="8"
$env:WINRK_CONNECTIONS="400"
$env:WINRK_DURATION="15"
bun run --cwd packages/bench bench:winrk

# tier-2 spiral (~2.4k tiles) -> winrk-spiral-latest.* (separate invocation only)
$env:WINRK_FIXTURE="spiral"
bun run --cwd packages/bench bench:winrk
```

Defaults: `t=8`, `c=400`, `d=15`, `WINRK_FIXTURE=counter`. Unknown fixture values log a warning and **fall back to counter** (no exit). Stacks run **one at a time** (sequential); never overlap winrk against multiple servers.

**Output files:** `docs/benchmarks/runs/winrk-latest.*` (counter) or `winrk-spiral-latest.*` (spiral) — note spelling **spiral**, not `spral`.

### cmd.exe (not PowerShell)

```cmd
set WINRK_FIXTURE=spiral
bun run --cwd packages/bench bench:winrk
```

**Do not** quote the value in cmd — `set WINRK_FIXTURE="spiral"` stores literal `"spiral"` and falls back to counter. PowerShell `$env:WINRK_FIXTURE="spiral"` is fine.

## Manual run (one stack)

### 1. Start server (terminal A)

```powershell
cd packages/bench
bun run src/winrk/serve-stack.ts luxel-ssr
```

Prints:

```text
stack:   luxel-ssr
url:     http://127.0.0.1:54321
winrk:   winrk -t12 -c400 -d15 http://127.0.0.1:54321
```

Use the printed `url` — port is ephemeral (`0` = OS picks).

### 2. Load test (terminal B)

```powershell
winrk -t12 -c400 -d15 http://127.0.0.1:54321
```

Replace port with value from terminal A.

### 3. Stop server

`Ctrl+C` in terminal A.

## Stack ids

| id | What it serves | Prerequisite |
|----|----------------|--------------|
| `luxel-ssr` | Counter SSR (per-request render) | none |
| `luxel-spiral-ssr` | Spiral tier-2 SSR (~2.4k tiles, render worker) | none |
| `react-spiral-ssr` | React 19 spiral `renderToString` | none |
| `vue-vdom-spiral-ssr` | Vue 3.5 spiral SSR | none |
| `vue-vapor-spiral-ssr` | Vue 3.6 Vapor spiral SSR | none |
| `solid-spiral-ssr` | Solid spiral `ssr` templates | none |
| `svelte-spiral-ssr` | Svelte 5 compiled spiral | none |
| `luxel-csr` | Counter SSG static `/about` | `luxel build` in `examples/counter` if no dist |
| `luxel-isr` | nav-demo ISR (1s revalidate + html cache) | none |
| `react-ssr` | React 19 `renderToString` per request | none |
| `react-csr` | Vite-built React CSR dist | `bun run build/react-csr.ts` in `competitors/` |
| `react-rsc` | Next.js App Router RSC | `bun run build/react-rsc.ts` in `competitors/` |
| `vue-vdom-csr` | Vite Vue 3.5 virtual DOM CSR | competitors CSR build |
| `vue-vapor-csr` | Vite Vue 3.6 beta Vapor CSR | competitors CSR build (`vue-vapor-csr`) |
| `solid-csr` | Vite Solid CSR | competitors CSR build |
| `solidstart-ssr` | SolidStart prod server | competitors framework build |
| `svelte-csr` | Vite Svelte CSR | competitors CSR build |
| `sveltekit-ssr` | SvelteKit adapter-node | competitors framework build |
| `sveltekit-isr` | SvelteKit + 1s in-memory ISR hook | competitors framework build |

List anytime:

```powershell
bun run src/winrk/serve-stack.ts
```

## Luxel stacks without serve-stack

Production-style deploy:

```powershell
# SSR / dev server
bun run --cwd examples/counter dev
# -> luxel dev http://127.0.0.1:3000

# prod serve (after build)
bun run --cwd packages/luxel build --cwd ../../examples/counter
bun run --cwd packages/luxel serve node
```

Then `winrk -t8 -c400 -d15 http://127.0.0.1:3000`.

## Fairness

Counter fixture DOM contract: `docs/benchmarks/fairness.md`.

CSR rows = static `index.html` + JS. SSR/RSC/ISR = fresh HTML per request (Luxel ISR = cache miss/regen under 1s TTL).
