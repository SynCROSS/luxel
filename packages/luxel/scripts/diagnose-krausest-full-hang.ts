/**
 * Diagnose loop for wayfinder #100: prove which phase of
 * `bench --krausest --full` runs with zero Chrome before driver.
 *
 * Exit 1 (red) = symptom confirmed: alive in pre-driver phase, chromeCount=0.
 * Exit 0 = reached chrome-resolve or driver args with chrome binary path (browser path entered).
 *
 * Usage:
 *   bun packages/luxel/scripts/diagnose-krausest-full-hang.ts
 *   bun packages/luxel/scripts/diagnose-krausest-full-hang.ts --timeout-ms=120000
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { repoKrausestSubmodulePath } from "../src/bench/krausest/contract.ts";
import {
  detectKrausestFrameworks,
  findLuxelKrausestFramework,
  resolveKrausestOfficialNonKeyedFrameworks,
} from "../src/bench/krausest/frameworks.ts";
import {
  ensureKrausestComparisonFrameworks,
  missingKrausestComparisonFrameworks,
  shouldFetchKrausestBuildZip,
} from "../src/bench/krausest/setup-frameworks.ts";
import { isKrausestBuildZipExtracted } from "../src/bench/krausest/setup-build-zip.ts";
import { ensureKrausestDriverBuilt } from "../src/bench/krausest/setup-driver.ts";
import { resolveKrausestChromeBinary } from "../src/bench/krausest/krausest-chrome.ts";
import { findChromeExecutable } from "../src/util/find-chrome.ts";

const repoRoot = join(import.meta.dir, "../../..");
const timeoutMs = Number(
  process.argv.find((a) => a.startsWith("--timeout-ms="))?.slice("--timeout-ms=".length) ??
    process.env.KRAUSEST_DIAGNOSE_TIMEOUT_MS ??
    120_000,
);

type PhaseEvent = { t: number; phase: string; detail?: string; chrome: number };

function countChromeProcesses(): number {
  if (process.platform !== "win32") {
    try {
      const out = spawnSync("ps", ["-eo", "comm="], { encoding: "utf8" });
      return (out.stdout ?? "")
        .split("\n")
        .filter((line) => /chrome|chromium|ungoogled/i.test(line.trim())).length;
    } catch {
      return 0;
    }
  }
  try {
    const out = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "(Get-Process chrome,chromium,msedge -ErrorAction SilentlyContinue | Measure-Object).Count",
      ],
      { encoding: "utf8", windowsHide: true },
    );
    return Number((out.stdout ?? "").trim()) || 0;
  } catch {
    return 0;
  }
}

function log(phase: string, detail?: string): PhaseEvent {
  const ev: PhaseEvent = {
    t: Date.now(),
    phase,
    detail,
    chrome: countChromeProcesses(),
  };
  const elapsed = ((ev.t - started) / 1000).toFixed(1);
  console.error(
    `[diagnose ${elapsed}s] phase=${phase} chrome=${ev.chrome}${detail ? ` ${detail}` : ""}`,
  );
  events.push(ev);
  return ev;
}

const events: PhaseEvent[] = [];
const started = Date.now();
const deadline = started + timeoutMs;

function assertNotTimedOut(phase: string): void {
  if (Date.now() > deadline) {
    log("TIMEOUT", `still in ${phase}; chrome=${countChromeProcesses()}`);
    console.error(
      JSON.stringify(
        {
          verdict: "RED",
          symptom: "pre-driver hang with zero Chrome (or timeout before Chrome)",
          timeoutMs,
          lastPhase: phase,
          chromeAtEnd: countChromeProcesses(),
          zipExtracted: isKrausestBuildZipExtracted(repoRoot),
          events,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

async function withHeartbeat<T>(phase: string, fn: () => Promise<T>): Promise<T> {
  log(`enter:${phase}`);
  const tick = setInterval(() => {
    log(`heartbeat:${phase}`, `elapsed=${((Date.now() - started) / 1000).toFixed(0)}s`);
  }, 5_000);
  try {
    const result = await Promise.race([
      fn(),
      (async () => {
        while (Date.now() <= deadline) {
          await Bun.sleep(500);
        }
        throw new Error(`diagnose timeout in ${phase}`);
      })(),
    ]);
    log(`exit:${phase}`);
    return result as T;
  } finally {
    clearInterval(tick);
  }
}

const submodule = repoKrausestSubmodulePath(repoRoot);
if (!existsSync(submodule)) {
  console.error("submodule missing");
  process.exit(2);
}

log("probe", `zipExtracted=${isKrausestBuildZipExtracted(repoRoot)}`);

const detected = detectKrausestFrameworks(submodule);
const official = resolveKrausestOfficialNonKeyedFrameworks(submodule);
const luxel = findLuxelKrausestFramework(detected);
if (!luxel) {
  console.error("luxel framework metadata missing");
  process.exit(2);
}
const selected = [...official, luxel];
const missing = missingKrausestComparisonFrameworks(submodule, selected);
log(
  "probe:missing",
  `official=${official.length} missing=${missing.length} willFetchZip=${shouldFetchKrausestBuildZip(missing, { useBuildZip: true, requireOfficialNonKeyedMatrix: true }, repoRoot)} names=${missing.map((f) => f.directory).join(",")}`,
);

try {
  await withHeartbeat("driver-build", async () => {
    assertNotTimedOut("driver-build");
    await ensureKrausestDriverBuilt(submodule);
  });

  await withHeartbeat("comparison-setup", async () => {
    assertNotTimedOut("comparison-setup");
    const setup = await ensureKrausestComparisonFrameworks(submodule, selected, repoRoot, {
      requireOfficialNonKeyedMatrix: true,
      useBuildZip: true,
    });
    log("setup-timings", `zipMs=${setup.zipMs} rebuildMs=${setup.rebuildMs}`);
  });

  // Server skipped — orphan risk. Chrome resolve is the stall gate on this machine.
  await withHeartbeat("chrome-resolve", async () => {
    assertNotTimedOut("chrome-resolve");
    const installed = findChromeExecutable();
    log("chrome-find", installed ?? "(none yet)");
    // Isolate: prefer-download path is what --full uses (needsMemoryApi=true).
    // Skip if env already set — that short-circuits resolve.
    if (process.env.KRAUSEST_CHROME_BINARY || process.env.CHROME_BIN || process.env.CHROME_PATH) {
      log("chrome-env-set", "resolve will short-circuit via env");
    }
    const resolution = await resolveKrausestChromeBinary(repoRoot, true);
    log("chrome-resolved", `${resolution.source} ${resolution.path}`);
  });

  const chromeEnd = countChromeProcesses();
  console.error(
    JSON.stringify(
      {
        verdict: "GREEN_REACHED_CHROME_RESOLVE",
        note: "Pre-driver setup finished and chrome binary resolved. Symptom may still be quiet-setup UX (no heartbeat) rather than hard hang.",
        chromeAtEnd: chromeEnd,
        zipExtracted: isKrausestBuildZipExtracted(repoRoot),
        events,
      },
      null,
      2,
    ),
  );
  process.exit(0);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  log("error", msg);
  const chromeEnd = countChromeProcesses();
  const red =
    /diagnose timeout/i.test(msg) ||
    (chromeEnd === 0 && !/chrome/i.test(msg) && Date.now() - started > 10_000);
  console.error(
    JSON.stringify(
      {
        verdict: red ? "RED" : "ERROR",
        error: msg,
        chromeAtEnd: chromeEnd,
        zipExtracted: isKrausestBuildZipExtracted(repoRoot),
        events,
      },
      null,
      2,
    ),
  );
  process.exit(red ? 1 : 2);
}
