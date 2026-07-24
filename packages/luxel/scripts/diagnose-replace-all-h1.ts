/**
 * Wayfinder #128: A/B same-length update-in-place vs prior all-dirty recreate.
 * Duration-only: create / replace / partial / clear vs vue-vapor.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runKrausestBench } from "../src/bench/krausest/run.ts";
import {
  detectKrausestFrameworks,
  findLuxelKrausestFramework,
} from "../src/bench/krausest/frameworks.ts";
import { repoKrausestSubmodulePath } from "../src/bench/krausest/contract.ts";

const repoRoot = join(import.meta.dir, "../../..");
const detected = detectKrausestFrameworks(repoKrausestSubmodulePath(repoRoot));
const luxel = findLuxelKrausestFramework(detected);
const vue = detected.find((f) => f.directory === "vue-vapor" && f.type === "non-keyed");
if (!luxel || !vue) {
  console.error("missing luxel or vue-vapor");
  process.exit(2);
}

const result = await runKrausestBench({
  repoRoot,
  frameworkLabels: [luxel.label, vue.label],
  scenarios: ["create_rows", "replace_all_rows", "partial_update", "clear_rows"],
  memoryScenarios: [],
  transferScenarios: [],
});

type Pair = { luxel: number; vue: number };
const by = new Map<string, Pair>();
for (const row of result.rows) {
  const key = row.scenario;
  const slot = by.get(key) ?? { luxel: NaN, vue: NaN };
  if (row.framework.includes("luxel")) slot.luxel = row.durationMs;
  else slot.vue = row.durationMs;
  by.set(key, slot);
}

const gaps = [...by.entries()].map(([scenario, v]) => {
  const ratio = v.luxel / v.vue;
  const status = v.luxel < v.vue ? "win" : "lose";
  console.log(
    `${scenario}\tluxel=${v.luxel.toFixed(1)}\tvue=${v.vue.toFixed(1)}\t${ratio.toFixed(3)}x\t${status}`,
  );
  return { scenario, luxel: v.luxel, vue: v.vue, ratio, status };
});

const outPath = join(repoRoot, "docs/benchmarks/runs/krausest-replace-h1-ab-count10.json");
await writeFile(
  outPath,
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      treatment: "same-length-update-inplace-no-recreate",
      driverCount: Number(process.env.KRAUSEST_DRIVER_COUNT ?? "10"),
      gaps,
    },
    null,
    2,
  ),
);
console.log(`wrote ${outPath}`);
