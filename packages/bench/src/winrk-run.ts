import "./winrk/apply-bench-host-env.ts";
import "@luxel/luxel/bench";
import { cleanupOrphanBenchProcesses } from "./winrk/bench-cleanup-orphans.ts";
import {
  runAllWinrkStacks,
  stacksForFixture,
  type WinrkBenchResult,
  type WinrkFixtureId,
} from "./winrk/registry.ts";
import { filterStacks } from "./winrk/stack-filter.ts";
import { runStacksIsolated } from "./winrk/isolated-run.ts";
import { buildRunMeta, writeFixtureRun, appendStackObservabilityLine, stackObservabilityFromResult } from "./winrk/run-output.ts";
import {
  evaluateWinrkReproGate,
  formatWinrkReproGateFailures,
} from "./winrk/repro-gate.ts";

function parseFixture(raw: string | undefined): WinrkFixtureId {
  const norm = raw?.trim().replace(/^["']|["']$/g, "").toLowerCase();
  if (norm === "spiral") return "spiral";
  if (norm === "all") {
    console.error(
      "WINRK_FIXTURE=all removed — run counter + spiral in separate Bun processes (fresh memory per fixture).",
    );
    console.error("  bun run bench:repro");
    console.error("  bun run bench:winrk:repro-all");
    process.exit(1);
  }
  if (norm && norm !== "counter" && norm !== "") {
    console.error(
      `unknown WINRK_FIXTURE=${JSON.stringify(raw)} — defaulting to counter (valid: counter, spiral)`,
    );
  }
  return "counter";
}

async function main() {
  const killed = cleanupOrphanBenchProcesses();
  if (killed > 0) console.error(`cleaned ${killed} orphan bench process(es)`);

  const fixtureArg = parseFixture(process.env.WINRK_FIXTURE);
  const generatedAt = new Date().toISOString();
  const meta = buildRunMeta(generatedAt);

  console.error(`load tester: ${meta.loadTester} (${meta.loadTesterPath})`);
  console.error(`fixture: ${fixtureArg}`);
  if (process.env.BENCH_RENDER_WORKER_BACKEND) {
    console.error(`render worker backend: ${process.env.BENCH_RENDER_WORKER_BACKEND}`);
  }
  console.error(
    `running ${meta.durationSec}s @ ${meta.connections} conn, ${meta.threads} threads`,
  );

  const fixture = fixtureArg;
  const stacks = filterStacks(stacksForFixture(fixture));
  if (process.env.WINRK_STACK || process.env.WINRK_STACK_UNTIL) {
    console.error(
      `stack filter: ${stacks.length} of ${stacksForFixture(fixture).length} (${stacks.map((r) => r.id).join(", ")})`,
    );
  }

  const isolate =
    process.env.BENCH_ISOLATE_STACKS === "1" || process.env.BENCH_ISOLATE_STACKS === "true";

  console.error(`\n=== fixture: ${fixture} ===`);
  const onProgress = async (partial: WinrkBenchResult[]) => {
    await writeFixtureRun(fixture, partial, meta);
    const latest = partial.at(-1);
    if (latest) {
      await appendStackObservabilityLine(
        fixture,
        stackObservabilityFromResult(latest, meta.generatedAt),
      );
    }
  };

  const results: WinrkBenchResult[] = isolate
    ? await runStacksIsolated(fixture, stacks, { onProgress })
    : await runAllWinrkStacks(stacks, { onProgress });

  await writeFixtureRun(fixture, results, meta);
  for (const row of results) {
    console.log(JSON.stringify({ fixture, ...row }));
  }

  const gate =
    process.env.BENCH_REPRO_GATE === "1" ? evaluateWinrkReproGate(fixture, results) : { ok: true, failures: [] };
  if (!gate.ok) {
    console.error(`repro gate failed (${fixture}):\n${formatWinrkReproGateFailures(gate.failures)}`);
    process.exit(1);
  }
}

main()
  .then(() => {
    const killed = cleanupOrphanBenchProcesses();
    if (killed > 0) console.error(`post-run cleanup: ${killed} orphan bench process(es)`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    cleanupOrphanBenchProcesses();
    process.exit(1);
  });
