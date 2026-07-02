import type { WinrkBenchResult, WinrkFixtureId } from "./registry.ts";
import { stacksForFixture } from "./registry.ts";
import { stackRole } from "./registry.ts";

export type WinrkReproFailure = { id: string; reason: string };

export type WinrkReproGateResult = {
  ok: boolean;
  failures: WinrkReproFailure[];
};

/** `bench:repro` exit gate — every stack runs; every framework row green (0% winrk errors). */
export function evaluateWinrkReproGate(
  fixture: WinrkFixtureId,
  results: WinrkBenchResult[],
): WinrkReproGateResult {
  const expected = stacksForFixture(fixture);
  const failures: WinrkReproFailure[] = [];
  const byId = new Map(results.map((row) => [row.id, row]));

  for (const row of expected) {
    const result = byId.get(row.id);
    if (!result) {
      failures.push({ id: row.id, reason: "stack not run (fixture incomplete)" });
      continue;
    }
    if (result.status === "pending") {
      failures.push({ id: row.id, reason: `pending: ${result.reason}` });
      continue;
    }
    if (result.status === "error") {
      failures.push({ id: row.id, reason: `error: ${result.reason}` });
      continue;
    }
    const winrkErrors = result.winrk.totalErrors ?? 0;
    if (stackRole(row) === "framework" && winrkErrors > 0) {
      failures.push({
        id: row.id,
        reason: `winrk errors ${winrkErrors} (repro requires 0)`,
      });
      continue;
    }
    if (stackRole(row) === "framework" && (result.errorRatePercent ?? 0) > 0) {
      failures.push({
        id: row.id,
        reason: `winrk error rate ${result.errorRatePercent}% (repro requires 0%)`,
      });
    }
  }

  return { ok: failures.length === 0, failures };
}

export function formatWinrkReproGateFailures(failures: WinrkReproFailure[]): string {
  return failures.map((f) => `  - ${f.id}: ${f.reason}`).join("\n");
}
