import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { KRAUSEST_COMPARE_DIRECTORIES, KRAUSEST_OFFICIAL_NON_KEYED_DIRECTORIES } from "./contract.ts";

export type KrausestFrameworkType = "keyed" | "non-keyed";

export type KrausestFrameworkInfo = {
  label: string;
  driverPath: string;
  type: KrausestFrameworkType;
  directory: string;
  customURL?: string;
  hasBuildProdScript: boolean;
};

type PackageJson = {
  scripts?: Record<string, string>;
  main?: string;
  "js-framework-benchmark"?: {
    frameworkVersionFromPackage?: string;
    frameworkVersion?: string;
    customURL?: string;
  };
};

type PackageLockJson = {
  dependencies?: Record<string, { version?: string }>;
  packages?: Record<string, { version?: string }>;
};

const KRAUSEST_FRAMEWORK_TYPES = ["keyed", "non-keyed"] as const;
const LUXEL_DRIVER_PATH = "non-keyed/luxel";
const LUXEL_LABEL_PREFIX = "luxel";

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function packageVersion(lock: PackageLockJson, packageName: string): string {
  return (
    lock.dependencies?.[packageName]?.version ??
    lock.packages?.[`node_modules/${packageName}`]?.version ??
    "ERROR: Not found in package-lock"
  );
}

function buildFrameworkVersionString(
  directory: string,
  version: string | undefined,
  type: KrausestFrameworkType,
): string {
  return `${directory}${version ? `-v${version}` : ""}-${type}`;
}

function frameworkInfo(
  submodule: string,
  type: KrausestFrameworkType,
  directory: string,
): KrausestFrameworkInfo | null {
  const frameworkDir = join(submodule, "frameworks", type, directory);
  const pkg = readJson<PackageJson>(join(frameworkDir, "package.json"));
  const lock = readJson<PackageLockJson>(join(frameworkDir, "package-lock.json"));
  const metadata = pkg?.["js-framework-benchmark"];
  if (!pkg || !lock || !metadata) return null;

  let version: string | undefined;
  if (metadata.frameworkVersionFromPackage) {
    version = metadata.frameworkVersionFromPackage
      .split(":")
      .map((name) => packageVersion(lock, name))
      .join(" + ");
  } else {
    version = metadata.frameworkVersion;
  }
  if (version === undefined) return null;

  return {
    label: buildFrameworkVersionString(directory, version, type),
    driverPath: `${type}/${directory}`,
    type,
    directory,
    customURL: metadata.customURL,
    hasBuildProdScript: Boolean(pkg.scripts?.["build-prod"]),
  };
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function detectKrausestFrameworks(submodule: string): KrausestFrameworkInfo[] {
  const frameworks: KrausestFrameworkInfo[] = [];
  for (const type of KRAUSEST_FRAMEWORK_TYPES) {
    const typeDir = join(submodule, "frameworks", type);
    if (!existsSync(typeDir)) continue;
    for (const directory of readdirSync(typeDir)) {
      if (!isDirectory(join(typeDir, directory))) continue;
      const info = frameworkInfo(submodule, type, directory);
      if (info) frameworks.push(info);
    }
  }

  return frameworks.sort((a, b) => {
    if (a.driverPath === LUXEL_DRIVER_PATH) return -1;
    if (b.driverPath === LUXEL_DRIVER_PATH) return 1;
    return a.label.localeCompare(b.label);
  });
}

export function findLuxelKrausestFramework(
  frameworks: readonly KrausestFrameworkInfo[],
): KrausestFrameworkInfo | undefined {
  return frameworks.find((framework) => framework.driverPath === LUXEL_DRIVER_PATH);
}

export function isLuxelKrausestFrameworkLabel(label: string | undefined): boolean {
  return label === LUXEL_LABEL_PREFIX || label?.startsWith(`${LUXEL_LABEL_PREFIX}-`) === true;
}

export function krausestFrameworkVariantFromLabel(label: string): KrausestFrameworkType {
  if (label.endsWith("-non-keyed")) return "non-keyed";
  if (label.endsWith("-keyed")) return "keyed";
  return "non-keyed";
}

export function resolveKrausestFrameworks(
  frameworks: readonly KrausestFrameworkInfo[],
  labels: readonly string[],
): KrausestFrameworkInfo[] {
  const byLabel = new Map(frameworks.map((framework) => [framework.label, framework]));
  return labels.flatMap((label) => {
    const framework = byLabel.get(label);
    return framework ? [framework] : [];
  });
}

export function resolveKrausestOfficialNonKeyedFrameworks(
  submodule: string,
): KrausestFrameworkInfo[] {
  const detected = detectKrausestFrameworks(submodule);
  return filterOfficialNonKeyedFrameworks(detected);
}

export function filterOfficialNonKeyedFrameworks(
  frameworks: readonly KrausestFrameworkInfo[],
): KrausestFrameworkInfo[] {
  const allow = new Set<string>(KRAUSEST_OFFICIAL_NON_KEYED_DIRECTORIES);
  const luxel = findLuxelKrausestFramework(frameworks);
  const official = frameworks
    .filter(
      (framework) =>
        framework.type === "non-keyed" &&
        allow.has(framework.directory) &&
        framework.driverPath !== LUXEL_DRIVER_PATH,
    )
    .sort((a, b) => a.label.localeCompare(b.label));
  return luxel ? [luxel, ...official] : official;
}

export function resolveKrausestCompareFrameworks(
  frameworks: readonly KrausestFrameworkInfo[],
  luxel: KrausestFrameworkInfo,
  directories: readonly string[] = KRAUSEST_COMPARE_DIRECTORIES,
): KrausestFrameworkInfo[] {
  const byDirectory = new Map(frameworks.map((framework) => [framework.directory, framework]));
  const selected: KrausestFrameworkInfo[] = [luxel];
  for (const directory of directories) {
    const framework = byDirectory.get(directory);
    if (framework?.type === "non-keyed" && framework.driverPath !== LUXEL_DRIVER_PATH) {
      selected.push(framework);
    }
  }
  return selected;
}
