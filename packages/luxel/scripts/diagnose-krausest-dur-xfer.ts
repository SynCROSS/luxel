/**
 * Tight loop: luxel 40_sizes after optional duration warm, full driver log to _dur_xfer_raw.txt
 * Exit 0 GREEN / 1 RED
 */
import { spawn, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  KRAUSEST_DURATION_SCENARIOS,
  KRAUSEST_UPSTREAM_BENCHMARK_IDS,
  KRAUSEST_UPSTREAM_SIZE_MAIN_ID,
  repoKrausestSubmodulePath,
} from "../src/bench/krausest/contract.ts";
import {
  detectKrausestFrameworks,
  findLuxelKrausestFramework,
} from "../src/bench/krausest/frameworks.ts";
import { resolveKrausestChromeBinary } from "../src/bench/krausest/krausest-chrome.ts";
import {
  ensureKrausestDriverBuilt,
  ensureKrausestServerDeps,
  krausestBenchmarkRunnerScript,
  krausestServerTsxCli,
  KRAUSEST_NPM_ENV,
} from "../src/bench/krausest/setup-driver.ts";
import { findNodeExecutable } from "../src/util/find-node.ts";
import { killProcessTree } from "../src/util/kill-process-tree.ts";

const repoRoot = join(import.meta.dir, "../../..");
const submodule = repoKrausestSubmodulePath(repoRoot);
const outPath = join(repoRoot, "_dur_xfer_raw.txt");
const host = process.env.KRAUSEST_HOST ?? "localhost";
const port = Number(process.env.KRAUSEST_PORT ?? 8080);
const mode = process.argv[2] ?? "dur+xfer"; // size | dur+xfer

async function serverReady(): Promise<boolean> {
  try {
    const res = await fetch(`http://${host}:${port}/ls`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer(): Promise<ChildProcess | null> {
  await ensureKrausestServerDeps(submodule);
  if (await serverReady()) return null;
  const node = findNodeExecutable();
  if (!node) throw new Error("no node");
  const child = spawn(node, [krausestServerTsxCli(submodule), "index.ts"], {
    cwd: join(submodule, "server"),
    stdio: ["ignore", "pipe", "pipe"],
    env: KRAUSEST_NPM_ENV,
    windowsHide: true,
  });
  for (let i = 0; i < 60; i++) {
    if (await serverReady()) return child;
    await Bun.sleep(250);
  }
  killProcessTree(child.pid);
  throw new Error("server not ready");
}

const luxel = findLuxelKrausestFramework(detectKrausestFrameworks(submodule));
if (!luxel) {
  console.error("luxel missing");
  process.exit(2);
}

await ensureKrausestDriverBuilt(submodule);
const server = await ensureServer();
const chrome = await resolveKrausestChromeBinary(repoRoot, false);
const node = findNodeExecutable();
if (!node) throw new Error("no node");

const benchIds =
  mode === "size"
    ? [KRAUSEST_UPSTREAM_SIZE_MAIN_ID]
    : [
        ...KRAUSEST_DURATION_SCENARIOS.map((s) => KRAUSEST_UPSTREAM_BENCHMARK_IDS[s]),
        KRAUSEST_UPSTREAM_SIZE_MAIN_ID,
      ];

const args = [
  "--chromeBinary",
  chrome.path,
  "--headless",
  "--count",
  "1",
  "--framework",
  luxel.driverPath,
  ...benchIds.flatMap((id) => ["--benchmark", id]),
];

console.error(`mode=${mode} chrome=${chrome.path} benches=${benchIds.join(",")}`);
const child = spawn(node, [krausestBenchmarkRunnerScript(submodule), ...args], {
  cwd: join(submodule, "webdriver-ts"),
  env: { ...KRAUSEST_NPM_ENV, LANG: "en_US.UTF-8" },
  windowsHide: true,
});

let out = "";
child.stdout?.on("data", (c) => {
  const t = String(c);
  out += t;
  process.stderr.write(t);
});
child.stderr?.on("data", (c) => {
  const t = String(c);
  out += t;
  process.stderr.write(t);
});
const code = await new Promise<number>((resolve) => child.on("close", (c) => resolve(c ?? 1)));
writeFileSync(outPath, out, "utf8");
console.error(`wrote ${outPath} exit=${code}`);
killProcessTree(server?.pid);
process.exit(code === 0 ? 0 : 1);
