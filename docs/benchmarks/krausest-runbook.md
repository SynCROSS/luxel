# Krausest bench runbook

- Submodule: `vendor/js-framework-benchmark` pinned to tag **chrome150** (see `docs/benchmarks/krausest-submodule-pin.md`)
- CI Chrome: **150** family (reference build `150.0.7871.47`; prefer ungoogled-chromium 150.x, CfT fallback)
- Luxel app: `examples/krausest-table`
- Sync: `bun packages/luxel/scripts/sync-krausest-luxel.ts` after `luxel build`
- Skip fast path: `LUXEL_BENCH_SKIP_KRAUSEST=1`
- Gate threshold: `LUXEL_KRAUSEST_GATE_THRESHOLD` (default **1.09**)
- Duration enforce: `LUXEL_KRAUSEST_GATE_ENFORCE=1` (default **off** — wiring pass reports geo-mean; set **1** to fail when geo-mean > threshold)

```bash
git submodule update --init vendor/js-framework-benchmark
bun packages/luxel/scripts/setup-krausest-driver.ts
cd examples/krausest-table && bun run build && bun run sync:krausest
```

Windows env (cmd):

```bat
set LUXEL_KRAUSEST_SMOKETEST=1
set LUXEL_BENCH_SKIP_INP=1
set LUXEL_BENCH_SKIP_SPIRAL=1
bun packages/luxel/src/cli.ts bench
```

PowerShell:

```powershell
$env:LUXEL_KRAUSEST_SMOKETEST=1; $env:LUXEL_BENCH_SKIP_INP=1; $env:LUXEL_BENCH_SKIP_SPIRAL=1; bun packages/luxel/src/cli.ts bench
```

Unix:

```bash
LUXEL_KRAUSEST_SMOKETEST=1 LUXEL_BENCH_SKIP_INP=1 LUXEL_BENCH_SKIP_SPIRAL=1 bun packages/luxel/src/cli.ts bench
```

Full matrix (local):

```powershell
$env:LUXEL_KRAUSEST_FULL=1; $env:LUXEL_BENCH_SKIP_INP=1; $env:LUXEL_BENCH_SKIP_SPIRAL=1; bun packages/luxel/src/cli.ts bench
```

Independent krausest only (skip counter/spiral/inp):

```powershell
$env:KRAUSEST_DRIVER_COUNT=1
bun packages/luxel/src/cli.ts bench --krausest                 # slice1 luxel smoke
bun packages/luxel/src/cli.ts bench --krausest --all-scenarios # luxel 15 scenarios
bun packages/luxel/src/cli.ts bench --krausest --compare       # luxel + 5 default non-keyed + artifacts
bun packages/luxel/src/cli.ts bench --krausest --full          # official 66 non-keyed + luxel + artifacts
bun packages/luxel/src/cli.ts bench --krausest --all-frameworks # all 225 keyed + non-keyed (multi-hour)
```

Or from repo root: `bun run bench:krausest:full` (delegates to `packages/luxel`).
Halogen (`non-keyed/halogen`) needs **Node 20 LTS** for Spago (`better-sqlite3` has no prebuild on Node 24). Install via fnm/nvm if the run fails at halogen toolchain. Wallace (`non-keyed/wallace`) uses chrome150 `build.zip` prebuilt `dist/main.js` when local webpack rebuild is broken/missing (`wallaceConfig is not defined` / missing `#run`).
Or from `packages/luxel`: `bun run bench:krausest`, `bench:krausest:all`, `bench:krausest:compare`, `bench:krausest:full`, `bench:krausest:all-frameworks`.

Phase stderr (setup before driver): heartbeat every **15s** (`KRAUSEST_PHASE_HEARTBEAT_MS`) + hard timeout per phase — `driver-build` 30m, `zip` 30m, `rebuild` 60m, `server-ready` 2m, `chrome-resolve` 2m, `driver-batch` 45m (override `KRAUSEST_PHASE_TIMEOUT_<PHASE>_MS`).

Orphan cleanup (WinRK + krausest): from `packages/bench`, `bun run bench:cleanup-orphans` — default kills bun/node matching krausest/js-framework-benchmark/webdriver-ts plus Chrome whose cmdline matches krausest fingerprints (`js-framework-benchmark`, `krausest-chrome`, puppeteer profile). Aggressive luxel-cli tree: `--aggressive` or `BENCH_CLEANUP_AGGRESSIVE=1`. Ctrl+C / harness `finally` kills server+driver+Chrome via process-tree kill (`taskkill /T` on Windows).

Luxel ships **non-keyed** only. `--full` is the apples-to-apples gate path (official chrome150 **66** non-keyed + Luxel). `--all-frameworks` adds keyed React/Solid/etc. in a separate report section; first run extracts upstream `build.zip` (or rebuilds missing frameworks).

`LUXEL_KRAUSEST_FULL=1` runs all duration + memory scenarios for Luxel and all detected official krausest framework implementations through the upstream driver. Rows are live results from `vendor/js-framework-benchmark/frameworks/{keyed,non-keyed}/...` entries with `js-framework-benchmark` metadata; pinned medians and non-krausest competitors are not mixed into fixture `krausest`. Uses **headless full Chrome** (stable traces; headed picks up stray mouse mousedown on Windows). Needs full Chromium (`chrome-win64/chrome.exe`), not `chrome-headless-shell`. Human summary on **stderr**; JSONL on stdout.

Smoke mode runs `--count 1 --headless` against Luxel only (CPU scenarios). Full/local runs also default `--count 1` (upstream default 15 flakes luxel mousedown traces on Windows). Override: `KRAUSEST_DRIVER_COUNT=15`. **Full matrix memory:** driver runs in batches of **8** frameworks (fresh upstream Node process per batch) so long runs do not accumulate unbounded stdout or Chrome RSS in one process. Override batch width: `KRAUSEST_FRAMEWORK_BATCH_SIZE=4`. Expect **multi-hour** wall time for `--full` (67 frameworks × 15 scenarios). Browser resolution order: `KRAUSEST_CHROME_BINARY` → ungoogled/CfT **cache** → installed Chrome/Edge/Playwright **only if major == 150** → timed ungoogled/CfT download (`KRAUSEST_CHROME_DOWNLOAD_TIMEOUT_MS`, default 120s; Windows uses `curl.exe`) → last-resort non-150 installed (warn). Playwright Chromium 148 alone causes `No commit event` driver failures — pin Chrome **150**. Driver setup patches upstream: (1) `await wait(100)` → `await wait(350)` before `tracing.stop` (alins Commit lag; override `KRAUSEST_PUPPETEER_POST_WAIT_MS`); (2) poll `performance` paint entries before size `first-paint` read (empty-array race → `startTime` TypeError); (3) retry CPU runs on `at most one mousedown` like the upstream click retry; (4) `protocolTimeout` **600000** ms on `puppeteer.launch` (default 180s → `Runtime.callFunctionOn timed out` / empty stats on heavy frameworks e.g. reflex-dom `04_select1k`; override `KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS`); (5) **skip awaiting** `forceGC` — hung `page.evaluate(gc)` cannot be cancelled by `Promise.race` and wedges CDP until protocolTimeout; (6) `checkElementHasClass` uses `classList.contains` (boolean) — returning `DOMTokenList` over CDP can hang `Runtime.callFunctionOn` on reflex-dom `04_select1k`. **Not** `chrome-headless-shell` — memory benches need `performance.measureUserAgentSpecificMemory`. If none found, smoke auto-runs `bunx playwright install chromium`.

Expected JSONL lines:

```json
{"fixture":"krausest","framework":"luxel-v0.0.0-non-keyed","metric":"krausest_create_rows_ms","value":...}
{"fixture":"krausest","framework":"luxel-v0.0.0-non-keyed","metric":"krausest_clear_rows_ms","value":...}
```

Artifacts (auto on `LUXEL_KRAUSEST_FULL=1` success): `docs/benchmarks/runs/krausest-latest.{json,jsonl,md,html}` — markdown table + krausest.github.io-style HTML with slowdown coloring (publish after full matrix green)
