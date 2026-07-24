import { existsSync, mkdirSync, readdirSync, statSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { KRAUSEST_CHROME_REFERENCE_BUILD } from "./contract.ts";
import {
  findChromeExecutable,
  isHeadlessShellChrome,
  resetChromeExecutableCache,
} from "../../util/find-chrome.ts";

export type KrausestChromeResolution = {
  path: string;
  version: string | null;
  source: "env" | "ungoogled-cache" | "ungoogled-download" | "cft-cache" | "cft-download" | "installed";
};

const UNGOOGLED_RELEASE_TAG = "150.0.7871.46-1.1";
const UNGOOGLED_VERSION_PREFIX = "150.0.7871.46";

/** Default body-download budget (matches chrome-resolve phase). Override: KRAUSEST_CHROME_DOWNLOAD_TIMEOUT_MS */
export const KRAUSEST_CHROME_DOWNLOAD_TIMEOUT_MS_DEFAULT = 120_000;

export function krausestChromeDownloadTimeoutMs(): number {
  const raw = process.env.KRAUSEST_CHROME_DOWNLOAD_TIMEOUT_MS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return KRAUSEST_CHROME_DOWNLOAD_TIMEOUT_MS_DEFAULT;
}

export function chromeVersionFromOutput(output: string): string | null {
  const match = output.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)/);
  return match?.[0] ?? null;
}

export function chromeMajor(version: string | null | undefined): number | null {
  if (!version) return null;
  const major = Number(version.split(".")[0]);
  return Number.isFinite(major) ? major : null;
}

/** Prefer local browser before network only when it matches chrome150 major. */
export function shouldPreferInstalledChromeBeforeDownload(
  version: string | null | undefined,
  referenceBuild = KRAUSEST_CHROME_REFERENCE_BUILD,
): boolean {
  const major = chromeMajor(version);
  const refMajor = chromeMajor(referenceBuild);
  return major != null && refMajor != null && major === refMajor;
}

export function chromeVersionWarning(
  resolvedVersion: string | null,
  referenceBuild = KRAUSEST_CHROME_REFERENCE_BUILD,
): string | null {
  if (!resolvedVersion) {
    return `krausest chrome: could not read browser version (reference ${referenceBuild})`;
  }
  const major = Number(resolvedVersion.split(".")[0]);
  if (major !== 150) {
    return `krausest chrome: major ${major} != 150 (reference ${referenceBuild}, got ${resolvedVersion})`;
  }
  if (resolvedVersion !== referenceBuild) {
    return `krausest chrome: build ${resolvedVersion} != reference ${referenceBuild}`;
  }
  return null;
}

export function krausestChromeCacheRoot(repoRoot: string): string {
  return join(repoRoot, ".cache", "krausest-chrome");
}

function readWindowsFileProductVersion(binaryPath: string): string | null {
  if (process.platform !== "win32") return null;
  try {
    const out = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `(Get-Item -LiteralPath '${binaryPath.replace(/'/g, "''")}').VersionInfo.ProductVersion`,
      ],
      { encoding: "utf8", windowsHide: true, timeout: 5_000 },
    );
    if (out.status !== 0) return null;
    return chromeVersionFromOutput(out.stdout ?? "");
  } catch {
    return null;
  }
}

function readChromeVersion(binaryPath: string): string | null {
  const result = spawnSync(binaryPath, ["--version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5_000,
  });
  if (result.status === 0) {
    const fromCli = chromeVersionFromOutput(`${result.stdout}\n${result.stderr}`);
    if (fromCli) return fromCli;
  }
  return readWindowsFileProductVersion(binaryPath);
}

function platformChromeForTestingPaths(): { subdir: string; archive: string; binaryRelative: string } {
  if (process.platform === "win32") {
    return {
      subdir: "win64",
      archive: "chrome-win64.zip",
      binaryRelative: join("chrome-win64", "chrome.exe"),
    };
  }
  if (process.platform === "darwin") {
    return {
      subdir: "mac-arm64",
      archive: "chrome-mac-arm64.zip",
      binaryRelative: join(
        "chrome-mac-arm64",
        "Google Chrome for Testing.app",
        "Contents",
        "MacOS",
        "Google Chrome for Testing",
      ),
    };
  }
  return {
    subdir: "linux64",
    archive: "chrome-linux64.zip",
    binaryRelative: join("chrome-linux64", "chrome"),
  };
}

function platformUngoogledAssetName(): string | null {
  if (process.platform === "win32") {
    return `ungoogled-chromium-${UNGOOGLED_VERSION_PREFIX}_windows_x64.zip`;
  }
  return null;
}

function findChromeInDir(root: string): string | null {
  if (!existsSync(root)) return null;
  const names = new Set(["chrome.exe", "chrome", "chromium.exe", "chromium"]);
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (names.has(entry)) return full;
    }
  }
  return null;
}

function usableChrome(
  path: string | null | undefined,
  needsMemoryApi: boolean,
): path is string {
  if (!path || !existsSync(path)) return false;
  if (needsMemoryApi && isHeadlessShellChrome(path)) return false;
  return true;
}

/** Fetch + write with hard timeout so large zip body cannot hang silently. */
export async function downloadChromeArchiveToFile(
  url: string,
  dest: string,
  timeoutMs = krausestChromeDownloadTimeoutMs(),
): Promise<void> {
  mkdirSync(join(dest, ".."), { recursive: true });
  console.error(`krausest chrome: downloading ${url} (timeout ${Math.round(timeoutMs / 1000)}s)`);
  const started = Date.now();

  // Prefer curl on Windows — Bun.write of large CfT zips has hung after HTTP 200.
  if (process.platform === "win32") {
    const curl = spawnSync(
      "curl.exe",
      ["-fsSL", "--connect-timeout", "20", "--max-time", String(Math.ceil(timeoutMs / 1000)), "-o", dest, url],
      { encoding: "utf8", windowsHide: true },
    );
    if (curl.status === 0 && existsSync(dest)) {
      console.error(`krausest chrome: download done (${Math.round((Date.now() - started) / 1000)}s)`);
      return;
    }
    const detail = `${curl.stdout ?? ""}\n${curl.stderr ?? ""}`.trim();
    throw new Error(
      `krausest chrome download failed via curl (exit ${curl.status}): ${url}${detail ? `\n${detail}` : ""}`,
    );
  }

  const controller = new AbortController();
  let writeTimer: ReturnType<typeof setTimeout> | undefined;
  const abortTimer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new Error(`krausest chrome download failed (${response.status}): ${url}`);
    }
    const remaining = Math.max(1_000, timeoutMs - (Date.now() - started));
    await Promise.race([
      Bun.write(Bun.file(dest), response),
      new Promise<never>((_, reject) => {
        writeTimer = setTimeout(() => {
          controller.abort();
          reject(new Error(`krausest chrome download timed out after ${timeoutMs}ms: ${url}`));
        }, remaining);
      }),
    ]);
    console.error(`krausest chrome: download done (${Math.round((Date.now() - started) / 1000)}s)`);
  } catch (err) {
    if (
      controller.signal.aborted ||
      (err instanceof Error &&
        (err.name === "AbortError" || /timed out after \d+ms/i.test(err.message)))
    ) {
      throw new Error(`krausest chrome download timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(abortTimer);
    if (writeTimer !== undefined) clearTimeout(writeTimer);
  }
}

function extractZipArchive(zipPath: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  const result = spawnSync("tar", ["-xf", zipPath, "-C", destDir], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`krausest chrome zip extract failed:\n${result.stdout}\n${result.stderr}`);
  }
}

export function chromeForTestingDownloadUrl(
  build = KRAUSEST_CHROME_REFERENCE_BUILD,
): string {
  const platform = platformChromeForTestingPaths();
  return `https://storage.googleapis.com/chrome-for-testing-public/${build}/${platform.subdir}/${platform.archive}`;
}

function cachedUngoogledChrome(repoRoot: string): string | null {
  const cacheRoot = join(krausestChromeCacheRoot(repoRoot), `ungoogled-${UNGOOGLED_RELEASE_TAG}`);
  return findChromeInDir(cacheRoot);
}

function cachedChromeForTesting(repoRoot: string): string | null {
  const platform = platformChromeForTestingPaths();
  const cacheRoot = join(krausestChromeCacheRoot(repoRoot), `cft-${KRAUSEST_CHROME_REFERENCE_BUILD}`);
  const binary = join(cacheRoot, platform.binaryRelative);
  if (existsSync(binary)) return binary;
  return findChromeInDir(cacheRoot);
}

async function downloadUngoogledChrome(repoRoot: string): Promise<string | null> {
  const asset = platformUngoogledAssetName();
  if (!asset) return null;

  const cacheRoot = join(krausestChromeCacheRoot(repoRoot), `ungoogled-${UNGOOGLED_RELEASE_TAG}`);
  const zipPath = join(cacheRoot, asset);
  const url = `https://github.com/ungoogled-software/ungoogled-chromium-windows/releases/download/${UNGOOGLED_RELEASE_TAG}/${asset}`;
  mkdirSync(cacheRoot, { recursive: true });
  try {
    await downloadChromeArchiveToFile(url, zipPath);
    extractZipArchive(zipPath, cacheRoot);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`krausest chrome: ungoogled download skipped (${detail})`);
    return null;
  }
  return findChromeInDir(cacheRoot);
}

async function downloadChromeForTesting(repoRoot: string): Promise<string | null> {
  const platform = platformChromeForTestingPaths();
  const cacheRoot = join(krausestChromeCacheRoot(repoRoot), `cft-${KRAUSEST_CHROME_REFERENCE_BUILD}`);
  const binary = join(cacheRoot, platform.binaryRelative);
  const zipPath = join(cacheRoot, platform.archive);
  const url = chromeForTestingDownloadUrl();
  await downloadChromeArchiveToFile(url, zipPath);
  extractZipArchive(zipPath, cacheRoot);
  if (existsSync(binary)) {
    if (process.platform !== "win32") chmodSync(binary, 0o755);
    return binary;
  }
  return findChromeInDir(cacheRoot);
}

function resolutionFromPath(
  path: string,
  source: KrausestChromeResolution["source"],
): KrausestChromeResolution {
  return { path, version: readChromeVersion(path), source };
}

/**
 * Resolve Chrome for the krausest driver.
 * Order: env → ungoogled/CfT **cache** → installed/Playwright **only if major matches pin** →
 * timed downloads → last-resort installed (any major, with warning).
 * Non-150 Playwright must not skip CfT download — missing timeline commit events break the driver.
 */
export async function resolveKrausestChromeBinary(
  repoRoot: string,
  needsMemoryApi: boolean,
): Promise<KrausestChromeResolution> {
  const fromEnv =
    process.env.KRAUSEST_CHROME_BINARY?.trim() ??
    process.env.CHROME_BIN?.trim() ??
    process.env.CHROME_PATH?.trim();
  if (usableChrome(fromEnv, needsMemoryApi)) {
    return resolutionFromPath(fromEnv, "env");
  }
  if (fromEnv && needsMemoryApi && isHeadlessShellChrome(fromEnv)) {
    throw new Error(
      "krausest memory benchmarks need full Chrome/Chromium, not chrome-headless-shell.",
    );
  }

  const ungoogledCached = cachedUngoogledChrome(repoRoot);
  if (usableChrome(ungoogledCached, needsMemoryApi)) {
    return resolutionFromPath(ungoogledCached, "ungoogled-cache");
  }

  const cftCached = cachedChromeForTesting(repoRoot);
  if (usableChrome(cftCached, needsMemoryApi)) {
    return resolutionFromPath(cftCached, "cft-cache");
  }

  resetChromeExecutableCache();
  const installed = findChromeExecutable();
  if (usableChrome(installed, needsMemoryApi)) {
    const installedVersion = readChromeVersion(installed);
    if (shouldPreferInstalledChromeBeforeDownload(installedVersion)) {
      console.error(
        `krausest chrome: using installed browser before download (${installed})`,
      );
      return resolutionFromPath(installed, "installed");
    }
    console.error(
      `krausest chrome: installed browser major ${chromeMajor(installedVersion) ?? "unknown"} != 150 — trying pin download first (${installed})`,
    );
  }

  const ungoogled = await downloadUngoogledChrome(repoRoot);
  if (usableChrome(ungoogled, needsMemoryApi)) {
    return resolutionFromPath(ungoogled, "ungoogled-download");
  }

  try {
    const cft = await downloadChromeForTesting(repoRoot);
    if (usableChrome(cft, needsMemoryApi)) {
      return resolutionFromPath(cft, "cft-download");
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Chrome for Testing download failed";
    console.error(`${detail}; falling back if installed browser exists`);
  }

  if (!installed) {
    throw new Error(
      [
        "Chrome/Chromium executable not found for krausest driver.",
        "Set KRAUSEST_CHROME_BINARY or allow auto-download (ungoogled/CfT).",
      ].join(" "),
    );
  }
  if (needsMemoryApi && isHeadlessShellChrome(installed)) {
    throw new Error(
      "krausest memory benchmarks need full Chrome/Chromium, not chrome-headless-shell.",
    );
  }
  console.error(
    `krausest chrome: using non-pin installed browser as last resort (${installed})`,
  );
  return resolutionFromPath(installed, "installed");
}

export function warnKrausestChromeVersion(resolution: KrausestChromeResolution): void {
  const warning = chromeVersionWarning(resolution.version);
  if (warning) console.error(warning);
}
