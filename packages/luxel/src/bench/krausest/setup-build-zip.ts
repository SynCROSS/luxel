import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { KRAUSEST_CHROME_PIN } from "./contract.ts";

export function krausestBuildZipCacheDir(repoRoot: string): string {
  return join(repoRoot, ".cache", "krausest-build-zip", KRAUSEST_CHROME_PIN);
}

export function krausestBuildZipMarker(repoRoot: string): string {
  return join(krausestBuildZipCacheDir(repoRoot), "extracted.json");
}

export function isKrausestBuildZipExtracted(repoRoot: string): boolean {
  const marker = krausestBuildZipMarker(repoRoot);
  if (!existsSync(marker)) return false;
  try {
    const raw = JSON.parse(readFileSync(marker, "utf8")) as { pin?: string };
    return raw.pin === KRAUSEST_CHROME_PIN;
  } catch {
    return false;
  }
}

function extractZipArchive(zipPath: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  const result = spawnSync("tar", ["-xf", zipPath, "-C", destDir], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`krausest build.zip extract failed:\n${result.stdout}\n${result.stderr}`);
  }
}

async function downloadBuildZip(repoRoot: string): Promise<string> {
  const cacheDir = krausestBuildZipCacheDir(repoRoot);
  mkdirSync(cacheDir, { recursive: true });
  const zipPath = join(cacheDir, "build.zip");
  const url = `https://github.com/krausest/js-framework-benchmark/releases/download/${KRAUSEST_CHROME_PIN}/build.zip`;
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`krausest build.zip download failed (${response.status})`);
  }
  await Bun.write(Bun.file(zipPath), response);
  return zipPath;
}

/** Extract upstream chrome150 build.zip into submodule when cache miss. */
export async function ensureKrausestBuildZipExtracted(
  repoRoot: string,
  submodule: string,
): Promise<boolean> {
  if (isKrausestBuildZipExtracted(repoRoot)) return false;
  const zipPath = await downloadBuildZip(repoRoot);
  extractZipArchive(zipPath, submodule);
  writeFileSync(
    krausestBuildZipMarker(repoRoot),
    `${JSON.stringify({ pin: KRAUSEST_CHROME_PIN, extractedAt: new Date().toISOString() })}\n`,
  );
  return true;
}
