/**
 * Luxel-only create_rows with current chrome resolution.
 * Exit 0 = GREEN, 1 = RED (commit-event / driver fail).
 */
import { join } from "node:path";
import { repoKrausestSubmodulePath } from "../src/bench/krausest/contract.ts";
import { detectKrausestFrameworks, findLuxelKrausestFramework } from "../src/bench/krausest/frameworks.ts";
import { runKrausestBench } from "../src/bench/krausest/run.ts";

const repoRoot = join(import.meta.dir, "../../..");
const luxel = findLuxelKrausestFramework(detectKrausestFrameworks(repoKrausestSubmodulePath(repoRoot)));
if (!luxel) {
  console.error("luxel missing");
  process.exit(2);
}

const result = await runKrausestBench({
  repoRoot,
  frameworkLabels: [luxel.label],
  skipComparisonFrameworkSetup: true,
  scenarios: ["create_rows"],
  memoryScenarios: [],
  transferScenarios: [],
});

if (result.status === "ok") {
  console.error(JSON.stringify({ verdict: "GREEN", rows: result.rows }, null, 2));
  process.exit(0);
}
const red = /No commit event|driver exit 1|empty array/i.test(result.reason);
console.error(JSON.stringify({ verdict: red ? "RED" : "OTHER", reason: result.reason }, null, 2));
process.exit(red ? 1 : 2);
