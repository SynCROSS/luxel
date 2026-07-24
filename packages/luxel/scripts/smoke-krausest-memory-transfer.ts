/**
 * Smoke memory + transfer: luxel vs vue-vapor (#126 ready_memory / first_paint).
 */
import { join } from "node:path";
import {
  krausestRowsToBenchLines,
  runKrausestBench,
  type KrausestRunRow,
} from "../src/bench/krausest/run.ts";
import {
  detectKrausestFrameworks,
  findLuxelKrausestFramework,
} from "../src/bench/krausest/frameworks.ts";
import { repoKrausestSubmodulePath } from "../src/bench/krausest/contract.ts";

const repoRoot = join(import.meta.dir, "../../..");
const submodule = repoKrausestSubmodulePath(repoRoot);
const detected = detectKrausestFrameworks(submodule);
const luxel = findLuxelKrausestFramework(detected);
const vueVapor = detected.find(
  (f) => f.directory === "vue-vapor" && f.type === "non-keyed",
);

if (!luxel || !vueVapor) {
  console.error("missing luxel or vue-vapor");
  process.exit(2);
}

process.env.KRAUSEST_DRIVER_COUNT ??= "5";
const memoryScenarios = ["ready_memory", "run_memory", "create_clear_1k_x5"] as const;
const transferScenarios = ["uncompressed_size", "compressed_size", "first_paint"] as const;

console.error(
  `smoke: ${luxel.label} vs ${vueVapor.label} count=${process.env.KRAUSEST_DRIVER_COUNT} [memory+transfer]`,
);

const result = await runKrausestBench({
  repoRoot,
  frameworkLabels: [luxel.label, vueVapor.label],
  scenarios: [],
  memoryScenarios: [...memoryScenarios],
  transferScenarios: [...transferScenarios],
});

if (result.status === "pending") {
  console.error(result.reason);
  process.exit(1);
}

function val(row: KrausestRunRow | undefined): number | null {
  if (!row) return null;
  if (row.memoryMb !== undefined && row.durationMs === 0) return row.memoryMb;
  if (row.transferKb !== undefined && row.durationMs === 0) return row.transferKb;
  return row.durationMs;
}

const byKey = new Map<string, KrausestRunRow>();
for (const row of result.rows) {
  byKey.set(`${row.framework}\0${row.scenario}`, row);
}

const scenarios = [...memoryScenarios, ...transferScenarios];
console.log("| Scenario | Luxel | Vue Vapor | Luxel/Vue | Status |");
console.log("| --- | ---: | ---: | ---: | --- |");
let wins = 0;
let loses = 0;
for (const scenario of scenarios) {
  const l = val(byKey.get(`${luxel.label}\0${scenario}`));
  const v = val(byKey.get(`${vueVapor.label}\0${scenario}`));
  if (l == null || v == null) {
    console.log(`| ${scenario} | ${l ?? "?"} | ${v ?? "?"} | — | missing |`);
    continue;
  }
  const ratio = l / v;
  const status = l < v ? "win" : l > v ? "lose" : "tie";
  if (status === "win") wins++;
  else if (status === "lose") loses++;
  console.log(
    `| ${scenario} | ${l.toFixed(2)} | ${v.toFixed(2)} | ${ratio.toFixed(3)}× | ${status} |`,
  );
}
console.error(`smoke summary: ${wins} win / ${loses} lose`);
for (const line of krausestRowsToBenchLines(result.rows)) {
  console.error(JSON.stringify(line));
}
