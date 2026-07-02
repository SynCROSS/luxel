import "./winrk/apply-bench-host-env.ts";
import "@luxel/luxel/bench";
import { cleanupOrphanBenchProcesses } from "./winrk/bench-cleanup-orphans.ts";
import {
  runAllWinrkStacks,
  stacksForFixture,
  type WinrkBenchResult,
} from "./winrk/registry.ts";
import { filterStacks } from "./winrk/stack-filter.ts";
import { runStacksIsolated } from "./winrk/isolated-run.ts";
import { buildRunMeta, writeFixtureRun, resetStackObservabilityDir, writeStackObservabilityLine, stackObservabilityFromResult } from "./winrk/run-output.ts";
import {
  evaluateWinrkReproGate,
  formatWinrkReproGateFailures,
} from "./winrk/repro-gate.ts";
import {
  evaluateWinrkGeoGate,
  formatWinrkGeoGateResult,
} from "./winrk/winrk-geo-gate.ts";
import { resolveWinrkFixture } from "./winrk/resolve-winrk-fixture.ts";

async function main() {
  const killed = cleanupOrphanBenchProcesses();
  if (killed > 0) console.error(`cleaned ${killed} orphan bench process(es)`);

  const resolved = resolveWinrkFixture(process.env);
  if ("fatal" in resolved) {
    console.error(resolved.fatal);
    process.exit(1);
  }
  if (resolved.notice) console.error(resolved.notice);
  const fixtureArg = resolved.fixture;
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
  await resetStackObservabilityDir(fixture);
  const onProgress = async (partial: WinrkBenchResult[]) => {
    await writeFixtureRun(fixture, partial, meta, { announce: false });
    const latest = partial.at(-1);
    if (latest) {
      await writeStackObservabilityLine(
        fixture,
        stackObservabilityFromResult(latest, meta.generatedAt),
      );
    }
  };

  const results: WinrkBenchResult[] = isolate
    ? await runStacksIsolated(fixture, stacks, { onProgress })
    : await runAllWinrkStacks(stacks, { onProgress });

  await writeFixtureRun(fixture, results, meta);

  const gate =
    process.env.BENCH_REPRO_GATE === "1" ? evaluateWinrkReproGate(fixture, results) : { ok: true, failures: [] };
  if (!gate.ok) {
    console.error(`repro gate failed (${fixture}):\n${formatWinrkReproGateFailures(gate.failures)}`);
    process.exit(1);
  }

  if (process.env.BENCH_GEO_GATE === "1") {
    const geoGate = evaluateWinrkGeoGate(fixture, results);
    if (!geoGate.ok) {
      console.error(`geo gate failed:\n${formatWinrkGeoGateResult(geoGate)}`);
      process.exit(1);
    }
    console.error(`geo gate passed:\n${formatWinrkGeoGateResult(geoGate)}`);
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
