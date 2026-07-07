export const KRAUSEST_DOM_BUTTON_IDS = [
  "run",
  "runlots",
  "add",
  "update",
  "clear",
  "swaprows",
] as const;

export const KRAUSEST_TABLE_SELECTOR = "table.test-data";

export type KrausestDomContract = {
  buttonIds: readonly string[];
  tableSelector: string;
};

export const KRAUSEST_DOM_CONTRACT: KrausestDomContract = {
  buttonIds: KRAUSEST_DOM_BUTTON_IDS,
  tableSelector: KRAUSEST_TABLE_SELECTOR,
};

export function krausestScenarioMetricId(scenarioSlug: string): string {
  return `krausest_${scenarioSlug}_ms`;
}

export function krausestMemoryMetricId(scenarioSlug: string): string {
  return `krausest_${scenarioSlug}_mb`;
}

/** Duration scenarios (non-keyed) from upstream table. */
export const KRAUSEST_DURATION_SCENARIOS = [
  "create_rows",
  "replace_all_rows",
  "partial_update",
  "select_row",
  "swap_rows",
  "remove_row",
  "create_many_rows",
  "append_rows",
  "clear_rows",
] as const;

export const KRAUSEST_MEMORY_SCENARIOS = [
  "ready_memory",
  "run_memory",
  "create_clear_1k_x5",
] as const;

export type KrausestDurationScenario = (typeof KRAUSEST_DURATION_SCENARIOS)[number];
export type KrausestMemoryScenario = (typeof KRAUSEST_MEMORY_SCENARIOS)[number];

/** Slice 1 upstream driver scenarios. */
export const KRAUSEST_SLICE1_SCENARIOS = ["create_rows", "clear_rows"] as const;

/** Upstream driver benchmark id → JSONL framework label. */
export const KRAUSEST_FRAMEWORK_MAP: Record<string, string> = {
  luxel: "luxel",
  "luxel-v0.0.0-non-keyed": "luxel",
  "react-hooks": "react",
  "react-hooks-v19.2.0": "react",
  "vue-v3.6.0-alpha.2": "vue-vdom",
  "vue-vapor-v3.6.0-alpha.2": "vue-vapor",
  "svelte-v5.42.1": "svelte",
  "solid-v1.9.3": "solid",
};

export const KRAUSEST_COMPARISON_FRAMEWORKS = [
  "luxel",
  "react",
  "vue-vdom",
  "vue-vapor",
  "svelte",
  "solid",
] as const;

/** Upstream CPU benchmark id per Luxel scenario slug (chrome148). */
export const KRAUSEST_UPSTREAM_BENCHMARK_IDS = {
  create_rows: "01_run1k",
  replace_all_rows: "02_replace1k",
  partial_update: "03_update10th1k_x16",
  select_row: "04_select1k",
  swap_rows: "05_swap1k",
  remove_row: "06_remove-one-1k",
  create_many_rows: "07_create10k",
  append_rows: "08_create1k-after1k_x2",
  clear_rows: "09_clear1k_x8",
} as const satisfies Record<KrausestDurationScenario, string>;

export const KRAUSEST_UPSTREAM_MEMORY_IDS = {
  ready_memory: "21_ready-memory",
  run_memory: "22_run-memory",
  create_clear_1k_x5: "25_run-clear-memory",
} as const satisfies Record<KrausestMemoryScenario, string>;

/** Vendored from js-framework-benchmark weighted geo-mean (Chrome 118+, chrome148 pin). */
export const KRAUSEST_SCENARIO_WEIGHTS: Record<KrausestDurationScenario, number> = {
  create_rows: 0.64,
  replace_all_rows: 0.56,
  partial_update: 0.56,
  select_row: 0.19,
  swap_rows: 0.13,
  remove_row: 0.53,
  create_many_rows: 0.56,
  append_rows: 0.55,
  clear_rows: 0.42,
};

/** Gate label → upstream driver framework directory (chrome148 build matrix). */
export const KRAUSEST_DRIVER_FRAMEWORK_DIRS: Record<
  (typeof KRAUSEST_COMPARISON_FRAMEWORKS)[number],
  string
> = {
  luxel: "luxel",
  react: "react-hooks-v19.2.0",
  "vue-vdom": "vue-v3.6.0-alpha.2",
  "vue-vapor": "vue-vapor-v3.6.0-alpha.2",
  svelte: "svelte-v5.42.1",
  solid: "solid-v1.9.3",
};

export function krausestDriverFrameworkPaths(
  labels: readonly (typeof KRAUSEST_COMPARISON_FRAMEWORKS)[number][],
): string[] {
  return labels.map((label) => `non-keyed/${KRAUSEST_DRIVER_FRAMEWORK_DIRS[label]}`);
}

export const KRAUSEST_MEMORY_CEILING = 1.5;

export const KRAUSEST_GATE_THRESHOLD = Number(process.env.LUXEL_KRAUSEST_GATE_THRESHOLD ?? 1.09);

export function repoKrausestSubmodulePath(repoRoot: string): string {
  return `${repoRoot}/vendor/js-framework-benchmark`;
}
