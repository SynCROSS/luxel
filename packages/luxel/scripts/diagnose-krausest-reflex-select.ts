/**
 * Red loop for reflex-dom 04_select1k CDP hang on --krausest --full.
 * Symptom: Runtime.callFunctionOn/evaluate timed out (+ empty stats).
 *
 *   bun packages/luxel/scripts/diagnose-krausest-reflex-select.ts
 * Differential (prove protocolTimeout patch):
 *   KRAUSEST_PUPPETEER_PROTOCOL_TIMEOUT_MS=100 bun packages/luxel/scripts/diagnose-krausest-reflex-select.ts  # RED
 *   bun packages/luxel/scripts/diagnose-krausest-reflex-select.ts  # GREEN (default 600000)
 * Exit 1 = RED (symptom present). Exit 0 = GREEN. Exit 2 = setup / other.
 */
import { join } from "node:path";
import { repoKrausestSubmodulePath } from "../src/bench/krausest/contract.ts";
import { detectKrausestFrameworks } from "../src/bench/krausest/frameworks.ts";
import { runKrausestBench } from "../src/bench/krausest/run.ts";

const repoRoot = join(import.meta.dir, "../../..");
const submodule = repoKrausestSubmodulePath(repoRoot);
const detected = detectKrausestFrameworks(submodule);
const reflex = detected.find(
  (f) => f.type === "non-keyed" && f.directory === "reflex-dom",
);
const luxel = detected.find(
  (f) => f.type === "non-keyed" && f.directory === "luxel",
);
if (!reflex || !luxel) {
  console.error(`framework metadata missing reflex=${!!reflex} luxel=${!!luxel}`);
  process.exit(2);
}

console.error(`diagnose reflex-select: label=${reflex.label} customURL=${reflex.customURL ?? ""}`);
const started = Date.now();
const result = await runKrausestBench({
  repoRoot,
  frameworkLabels: [reflex.label, luxel.label],
  skipComparisonFrameworkSetup: true,
  scenarios: ["select_row"],
  memoryScenarios: [],
  transferScenarios: [],
});
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

if (result.status === "ok") {
  console.error(
    JSON.stringify({ verdict: "GREEN", elapsedS: elapsed, rows: result.rows.length }, null, 2),
  );
  process.exit(0);
}

const reason = result.reason;
const red =
  /callFunctionOn timed out|Runtime\.evaluate timed out|protocolTimeout|empty array|failed benchmarks:\s*04_select1k|driver exit 1/i.test(
    reason,
  );
console.error(
  JSON.stringify({ verdict: red ? "RED" : "OTHER", elapsedS: elapsed, reason }, null, 2),
);
process.exit(red ? 1 : 2);
