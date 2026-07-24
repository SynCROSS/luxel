/**
 * Red loop for alins "No commit event" on --krausest --full.
 * Asserts: alins-only create_rows run returns pending with commit-event / empty-array symptom.
 *
 *   bun packages/luxel/scripts/diagnose-krausest-alins.ts
 * Exit 1 = RED (symptom present). Exit 0 = GREEN (alins ok). Exit 2 = setup error.
 */
import { join } from "node:path";
import { repoKrausestSubmodulePath } from "../src/bench/krausest/contract.ts";
import { detectKrausestFrameworks } from "../src/bench/krausest/frameworks.ts";
import { runKrausestBench } from "../src/bench/krausest/run.ts";

const repoRoot = join(import.meta.dir, "../../..");
const submodule = repoKrausestSubmodulePath(repoRoot);
const detected = detectKrausestFrameworks(submodule);
const alins = detected.find(
  (f) => f.type === "non-keyed" && f.directory === "alins",
);
const luxel = detected.find(
  (f) => f.type === "non-keyed" && f.directory === "luxel",
);
if (!alins || !luxel) {
  console.error(`framework metadata missing alins=${!!alins} luxel=${!!luxel}`);
  process.exit(2);
}

console.error(`diagnose alins: label=${alins.label} (+luxel required by harness)`);
const started = Date.now();
const result = await runKrausestBench({
  repoRoot,
  frameworkLabels: [alins.label, luxel.label],
  skipComparisonFrameworkSetup: true,
  scenarios: ["create_rows"],
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
  /No commit event|empty array|driver exit 1|failed benchmarks/i.test(reason);
console.error(
  JSON.stringify({ verdict: red ? "RED" : "OTHER", elapsedS: elapsed, reason }, null, 2),
);
process.exit(red ? 1 : 2);
