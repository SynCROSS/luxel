/**
 * Smoke DRIVER create/replace/partial: luxel vs vue-vapor (issue #120).
 * Env: KRAUSEST_DRIVER_COUNT (default 3).
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

process.env.KRAUSEST_DRIVER_COUNT ??= "3";
const scenarios = ["create_rows", "replace_all_rows", "partial_update"] as const;

console.error(
  `smoke: ${luxel.label} vs ${vueVapor.label} count=${process.env.KRAUSEST_DRIVER_COUNT} [${scenarios.join(", ")}]`,
);

const result = await runKrausestBench({
  repoRoot,
  frameworkLabels: [luxel.label, vueVapor.label],
  scenarios: [...scenarios],
  memoryScenarios: [],
  transferScenarios: [],
});

if (result.status === "pending") {
  console.error(result.reason);
  process.exit(1);
}

function ms(row: KrausestRunRow | undefined): number | null {
  return row?.durationMs ?? null;
}

const byKey = new Map<string, KrausestRunRow>();
for (const row of result.rows) {
  byKey.set(`${row.framework}\0${row.scenario}`, row);
}

console.log("| Scenario | Luxel | Vue Vapor | Luxel/Vue | Status |");
console.log("| --- | ---: | ---: | ---: | --- |");
let wins = 0;
let loses = 0;
for (const scenario of scenarios) {
  const l = ms(byKey.get(`${luxel.label}\0${scenario}`));
  const v = ms(byKey.get(`${vueVapor.label}\0${scenario}`));
  if (l == null || v == null) {
    console.log(`| ${scenario} | ${l ?? "?"} | ${v ?? "?"} | — | missing |`);
    continue;
  }
  const ratio = l / v;
  const status = l < v ? "win" : l > v ? "lose" : "tie";
  if (status === "win") wins++;
  else if (status === "lose") loses++;
  console.log(
    `| ${scenario} | ${l.toFixed(2)} ms | ${v.toFixed(2)} ms | ${ratio.toFixed(3)}× | ${status} |`,
  );
}
console.error(`smoke summary: ${wins} win / ${loses} lose`);
for (const line of krausestRowsToBenchLines(result.rows)) {
  console.error(JSON.stringify(line));
}
