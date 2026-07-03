import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WinrkFixtureId } from "./winrk/registry.ts";
import { cleanupOrphanBenchProcesses } from "./winrk/bench-cleanup-orphans.ts";

const benchRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const bun = process.execPath;

const FIXTURES: WinrkFixtureId[] = ["counter", "spiral"];

/** Full repro runs every stack — drop bisect filters inherited from parent shell. */
function winrkEnvForFixture(fixture: WinrkFixtureId): NodeJS.ProcessEnv {
  const env = { ...process.env, WINRK_FIXTURE: fixture, BENCH_REPRO_GATE: "1" };
  delete env.WINRK_STACK;
  delete env.WINRK_STACK_UNTIL;
  return env;
}

function runFixtureSubprocess(fixture: WinrkFixtureId): Promise<number> {
  return new Promise((resolve, reject) => {
    console.error(`\n==> fixture subprocess: ${fixture} (sequential stacks, one server at a time)`);
    const child = spawn(bun, ["run", "src/winrk-run.ts"], {
      cwd: benchRoot,
      env: winrkEnvForFixture(fixture),
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function mergeResults(): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(bun, ["run", "src/winrk-merge.ts"], {
      cwd: benchRoot,
      env: { ...process.env, BENCH_REPRO_GATE: "1" },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const killed = cleanupOrphanBenchProcesses();
  if (killed > 0) {
    console.error(`cleaned ${killed} orphan bench process(es)`);
  }

  let worst = 0;
  for (const fixture of FIXTURES) {
    const code = await runFixtureSubprocess(fixture);
    if (code !== 0) worst = code;
  }

  const mergeCode = await mergeResults();
  if (mergeCode !== 0) process.exit(mergeCode);
  process.exit(worst);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
