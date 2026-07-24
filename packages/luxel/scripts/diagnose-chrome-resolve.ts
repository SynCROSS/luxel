/** Isolate: time each step of resolveKrausestChromeBinary. */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveKrausestChromeBinary } from "../src/bench/krausest/krausest-chrome.ts";
import { findChromeExecutable } from "../src/util/find-chrome.ts";

const repoRoot = join(import.meta.dir, "../../..");
const t0 = Date.now();
const log = (m: string) => console.error(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

const timeoutMs = Number(process.env.KRAUSEST_DIAGNOSE_TIMEOUT_MS ?? 60_000);
const timer = setTimeout(() => {
  log(`TIMEOUT after ${timeoutMs}ms — still inside resolveKrausestChromeBinary`);
  process.exit(1);
}, timeoutMs);

log(`findChrome=${findChromeExecutable()}`);
log(`env=${process.env.KRAUSEST_CHROME_BINARY ?? "(unset)"}`);
log(`ungoogledDirExists=${existsSync(join(repoRoot, ".cache/krausest-chrome/ungoogled-150.0.7871.46-1.1"))}`);
log(`cftDirExists=${existsSync(join(repoRoot, ".cache/krausest-chrome/cft-150.0.7871.47"))}`);

try {
  const r = await resolveKrausestChromeBinary(repoRoot, true);
  clearTimeout(timer);
  log(`OK source=${r.source} path=${r.path} version=${r.version}`);
  process.exit(0);
} catch (e) {
  clearTimeout(timer);
  log(`ERR ${e instanceof Error ? e.message : e}`);
  process.exit(2);
}
