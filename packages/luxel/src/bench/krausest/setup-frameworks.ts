import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { KRAUSEST_OFFICIAL_NON_KEYED_DIRECTORIES } from "./contract.ts";
import { rebuildKrausestFramework, wallaceArtifactReady } from "./framework-patches.ts";
import { ensureKrausestBuildZipExtracted } from "./setup-build-zip.ts";
import { withKrausestPhaseTimeout } from "./progress.ts";
import type { KrausestFrameworkInfo } from "./frameworks.ts";

export type EnsureKrausestFrameworksOptions = {
  requireOfficialNonKeyedMatrix?: boolean;
  useBuildZip?: boolean;
};

function frameworkDir(submodule: string, framework: KrausestFrameworkInfo): string {
  return join(submodule, "frameworks", framework.driverPath);
}

function frameworkIndexPath(
  submodule: string,
  framework: KrausestFrameworkInfo,
): string {
  return join(frameworkDir(submodule, framework), "index.html");
}

function readFrameworkPackage(
  submodule: string,
  framework: KrausestFrameworkInfo,
): { scripts?: Record<string, string>; main?: string } | null {
  try {
    return JSON.parse(
      readFileSync(join(frameworkDir(submodule, framework), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string>; main?: string };
  } catch {
    return null;
  }
}

function frameworkBuildOutputPaths(
  submodule: string,
  framework: KrausestFrameworkInfo,
): string[] {
  const dir = frameworkDir(submodule, framework);
  const paths: string[] = [];
  if (framework.customURL) {
    paths.push(join(dir, framework.customURL.replace(/^\//, ""), "index.html"));
  }
  const pkgMain = readFrameworkPackage(submodule, framework)?.main?.trim();
  if (pkgMain && !pkgMain.startsWith("http")) {
    paths.push(join(dir, pkgMain));
  }
  paths.push(
    join(dir, "dist/main.js"),
    join(dir, "dist/index.js"),
    join(dir, "dist/bundle.js"),
    join(dir, "dist/bundle.esm.js"),
    join(dir, "dist/app.min.js"),
    join(dir, "dist/index.html"),
    join(dir, "dist/.built"),
    join(dir, "dist/Entrypoint.bc.js"),
    join(dir, "main.mjs"),
    join(dir, "bundle.js"),
    join(dir, "public/build/bundle.js"),
    join(dir, "bundled-dist/index.html"),
    join(dir, "bundled-dist/index.js"),
    join(dir, "output-es/bundle.js"),
  );
  return paths;
}

function readFrameworkPackageScripts(
  submodule: string,
  framework: KrausestFrameworkInfo,
): Record<string, string> | undefined {
  return readFrameworkPackage(submodule, framework)?.scripts;
}

function buildProdScript(submodule: string, framework: KrausestFrameworkInfo): string | undefined {
  return readFrameworkPackageScripts(submodule, framework)?.["build-prod"]?.trim();
}

export function isNoopBuildProdScript(submodule: string, framework: KrausestFrameworkInfo): boolean {
  const script = buildProdScript(submodule, framework);
  if (!script) return false;
  if (script === "echo 0" || script === "echo 0;") return true;
  if (script === "exit 0") return true;
  return /This is a no-op/i.test(script);
}

export function hasFrameworkBuildArtifact(submodule: string, framework: KrausestFrameworkInfo): boolean {
  if (framework.driverPath === "non-keyed/luxel") {
    return existsSync(frameworkIndexPath(submodule, framework));
  }
  if (
    framework.driverPath === "non-keyed/wallace" ||
    framework.driverPath === "keyed/wallace"
  ) {
    return wallaceArtifactReady(frameworkDir(submodule, framework));
  }
  if (frameworkBuildOutputPaths(submodule, framework).some((path) => existsSync(path))) {
    return true;
  }
  if (!framework.hasBuildProdScript || isNoopBuildProdScript(submodule, framework)) {
    return existsSync(frameworkIndexPath(submodule, framework));
  }
  return false;
}

export function missingKrausestComparisonFrameworks(
  submodule: string,
  frameworks: readonly KrausestFrameworkInfo[],
): KrausestFrameworkInfo[] {
  const missing: KrausestFrameworkInfo[] = [];
  for (const framework of frameworks) {
    if (framework.driverPath === "non-keyed/luxel") continue;
    if (!hasFrameworkBuildArtifact(submodule, framework)) {
      missing.push(framework);
    }
  }
  return missing;
}

export function krausestFrameworkRebuildArgs(
  frameworks: readonly KrausestFrameworkInfo[],
): string[] {
  return frameworks
    .filter((framework) => framework.driverPath !== "non-keyed/luxel")
    .map((framework) => framework.driverPath);
}

function gitCheckoutFrameworks(
  submodule: string,
  frameworks: readonly KrausestFrameworkInfo[],
): void {
  const paths = frameworks
    .filter((framework) => framework.driverPath !== "non-keyed/luxel")
    .map((framework) => `frameworks/${framework.driverPath}`);
  if (paths.length === 0) return;

  const result = spawnSync("git", ["-C", submodule, "checkout", "HEAD", "--", ...paths], {
    stdio: "pipe",
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `krausest framework checkout failed:\n${result.stdout}\n${result.stderr}\npaths: ${paths.join(", ")}`,
    );
  }
}

function frameworksNeedingRebuild(
  submodule: string,
  frameworks: readonly KrausestFrameworkInfo[],
): KrausestFrameworkInfo[] {
  return frameworks.filter((framework) => {
    if (isNoopBuildProdScript(submodule, framework) && hasFrameworkBuildArtifact(submodule, framework)) {
      return false;
    }
    return true;
  });
}

function rebuildFrameworks(
  submodule: string,
  frameworks: readonly KrausestFrameworkInfo[],
): void {
  const rebuildArgs = krausestFrameworkRebuildArgs(frameworks);
  for (const frameworkPath of rebuildArgs) {
    const result = rebuildKrausestFramework(submodule, frameworkPath);
    if (!result.ok) {
      throw new Error(`krausest framework ${result.detail}`);
    }
  }
}

export function runnableKrausestComparisonFrameworks(
  submodule: string,
  frameworks: readonly KrausestFrameworkInfo[],
): KrausestFrameworkInfo[] {
  return frameworks.filter(
    (framework) =>
      framework.driverPath === "non-keyed/luxel" ||
      !missingKrausestComparisonFrameworks(submodule, [framework]).length,
  );
}

/** True when chrome150 build.zip should be fetched (missing artifacts remain). */
export function shouldFetchKrausestBuildZip(
  missing: readonly KrausestFrameworkInfo[],
  opts?: EnsureKrausestFrameworksOptions,
  repoRoot?: string,
): boolean {
  return missing.length > 0 && opts?.useBuildZip !== false && repoRoot !== undefined;
}

/** Materialize upstream comparison frameworks from the pinned submodule (chrome150). */
export async function ensureKrausestComparisonFrameworks(
  submodule: string,
  frameworks: readonly KrausestFrameworkInfo[],
  repoRoot?: string,
  opts?: EnsureKrausestFrameworksOptions,
): Promise<{ zipMs: number; rebuildMs: number }> {
  let zipMs = 0;
  let rebuildMs = 0;
  let missing = missingKrausestComparisonFrameworks(submodule, frameworks);
  if (shouldFetchKrausestBuildZip(missing, opts, repoRoot)) {
    const zipStart = Date.now();
    await withKrausestPhaseTimeout("zip", async () => {
      await ensureKrausestBuildZipExtracted(repoRoot!, submodule);
    });
    zipMs = Date.now() - zipStart;
    missing = missingKrausestComparisonFrameworks(submodule, frameworks);
  }

  if (missing.length === 0) {
    assertOfficialNonKeyedMatrixComplete(submodule, frameworks, opts?.requireOfficialNonKeyedMatrix);
    return { zipMs, rebuildMs };
  }

  const rebuildStart = Date.now();
  await withKrausestPhaseTimeout("rebuild", async () => {
    const toRebuild = frameworksNeedingRebuild(submodule, missing);
    if (toRebuild.length > 0) {
      gitCheckoutFrameworks(submodule, toRebuild);
      rebuildFrameworks(submodule, toRebuild);
    }
  });
  rebuildMs = Date.now() - rebuildStart;

  const stillMissing = missingKrausestComparisonFrameworks(submodule, frameworks);
  if (stillMissing.length > 0) {
    throw new Error(
      `krausest comparison frameworks still missing after rebuild: ${stillMissing
        .map((framework) => framework.label)
        .join(", ")}`,
    );
  }

  assertOfficialNonKeyedMatrixComplete(submodule, frameworks, opts?.requireOfficialNonKeyedMatrix);
  return { zipMs, rebuildMs };
}

export function assertOfficialNonKeyedMatrixComplete(
  submodule: string,
  frameworks: readonly KrausestFrameworkInfo[],
  requireOfficialNonKeyedMatrix?: boolean,
): void {
  if (!requireOfficialNonKeyedMatrix) return;
  const allow = new Set<string>(KRAUSEST_OFFICIAL_NON_KEYED_DIRECTORIES);
  const present = new Set(
    frameworks
      .filter((framework) => framework.type === "non-keyed" && allow.has(framework.directory))
      .map((framework) => framework.directory),
  );
  const missingDirs = KRAUSEST_OFFICIAL_NON_KEYED_DIRECTORIES.filter((directory) => !present.has(directory));
  if (missingDirs.length > 0) {
    throw new Error(
      `krausest official non-keyed matrix incomplete (${missingDirs.length}/66 missing metadata): ${missingDirs.join(", ")}`,
    );
  }
  const missingArtifacts = missingKrausestComparisonFrameworks(
    submodule,
    frameworks.filter(
      (framework) => framework.type === "non-keyed" && allow.has(framework.directory),
    ),
  );
  if (missingArtifacts.length > 0) {
    throw new Error(
      `krausest official non-keyed matrix incomplete after setup: ${missingArtifacts
        .map((framework) => framework.directory)
        .join(", ")}`,
    );
  }
}
