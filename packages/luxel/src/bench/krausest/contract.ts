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

export const KRAUSEST_CHROME_PIN = "chrome150";

/** Reference Chrome build for published chrome150 results. */
export const KRAUSEST_CHROME_REFERENCE_BUILD = "150.0.7871.47";

/** Official non-keyed directories from chrome150 published matrix (excludes Luxel). */
export const KRAUSEST_OFFICIAL_NON_KEYED_DIRECTORIES = [
  "aberdeen",
  "alins",
  "apprun",
  "arrowjs",
  "art",
  "aurelia",
  "bau",
  "binding.scala",
  "bui",
  "cyclejs-dom",
  "cydon",
  "deleight",
  "delorean",
  "dlightjs",
  "doz",
  "ef-js",
  "elm",
  "fast",
  "frei-hooks",
  "gyron",
  "halogen",
  "hydro-js",
  "imba",
  "incr_dom",
  "inferno",
  "knno-jsx",
  "kobold",
  "korvin",
  "legend-state-optimized",
  "lit-html",
  "lit",
  "literaljs",
  "maquette",
  "mikado",
  "mimbl",
  "mogwai",
  "mutraction",
  "openui5",
  "plastron-dom",
  "qingkuai",
  "quel",
  "ractive",
  "ravel",
  "redom",
  "reflex-dom",
  "reken",
  "riot",
  "san",
  "scarlets-frame",
  "seed",
  "skruv-liten",
  "slim-js",
  "solarite",
  "stdweb",
  "svelte-classic",
  "udomsay-esx",
  "uhtml",
  "ui5-webcomponents",
  "vanillajs-1",
  "vanillajs-3",
  "vanillajs",
  "vode",
  "vue-jsx-vapor",
  "vue-vapor",
  "vue",
  "wallace",
] as const;

export type KrausestOfficialNonKeyedDirectory = (typeof KRAUSEST_OFFICIAL_NON_KEYED_DIRECTORIES)[number];

export function krausestScenarioMetricId(scenarioSlug: string): string {
  return `krausest_${scenarioSlug}_ms`;
}

export function krausestMemoryMetricId(scenarioSlug: string): string {
  return `krausest_${scenarioSlug}_mb`;
}

export function krausestTransferMetricId(scenarioSlug: string): string {
  return `krausest_${scenarioSlug}_kb`;
}

/** Upstream size main benchmark id (expands to 41/42/43 subbenchmarks in createResultJS). */
export const KRAUSEST_UPSTREAM_SIZE_MAIN_ID = "40_sizes";

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

export const KRAUSEST_TRANSFER_SCENARIOS = [
  "uncompressed_size",
  "compressed_size",
  "first_paint",
] as const;

export type KrausestDurationScenario = (typeof KRAUSEST_DURATION_SCENARIOS)[number];
export type KrausestMemoryScenario = (typeof KRAUSEST_MEMORY_SCENARIOS)[number];
export type KrausestTransferScenario = (typeof KRAUSEST_TRANSFER_SCENARIOS)[number];

/** Slice 1 upstream driver scenarios. */
export const KRAUSEST_SLICE1_SCENARIOS = ["create_rows", "clear_rows"] as const;

/** Upstream CPU benchmark id per Luxel scenario slug (chrome150). */
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

export const KRAUSEST_UPSTREAM_TRANSFER_IDS = {
  uncompressed_size: "41_size-uncompressed",
  compressed_size: "42_size-compressed",
  first_paint: "43_first-paint",
} as const satisfies Record<KrausestTransferScenario, string>;

/** Vendored from js-framework-benchmark weighted geo-mean (Chrome 118+, chrome150 pin). */
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

export const KRAUSEST_MEMORY_CEILING = 1.5;

export const KRAUSEST_GATE_THRESHOLD = Number(process.env.LUXEL_KRAUSEST_GATE_THRESHOLD ?? 1.09);

/** When false (default), krausest gate passes on wired runner + memory ceiling; duration geo is reported only. */
export function krausestGateEnforced(): boolean {
  const raw = process.env.LUXEL_KRAUSEST_GATE_ENFORCE?.trim();
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return false;
}

export function repoKrausestSubmodulePath(repoRoot: string): string {
  return `${repoRoot}/vendor/js-framework-benchmark`;
}

/** Default non-keyed comparison set for `--compare` artifact runs (official upstream dirs). */
export const KRAUSEST_COMPARE_DIRECTORIES = [
  "vanillajs-1",
  "lit-html",
  "svelte-classic",
  "inferno",
  "vue-vapor",
] as const;
