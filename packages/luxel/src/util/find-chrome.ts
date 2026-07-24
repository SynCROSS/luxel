import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function newestExisting(paths: string[]): string | null {
  let best: { path: string; mtime: number } | null = null;
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const mtime = statSync(path).mtimeMs;
    if (!best || mtime > best.mtime) best = { path, mtime };
  }
  return best?.path ?? null;
}

function registryAppPath(exeName: string): string | null {
  if (process.platform !== "win32") return null;
  const keys = [
    `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`,
    `HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`,
  ];
  for (const key of keys) {
    const result = spawnSync("reg", ["query", key, "/ve"], { encoding: "utf8" });
    if (result.status !== 0) continue;
    const match = result.stdout.match(/REG_(?:SZ|EXPAND_SZ)\s+(.+)/);
    const path = match?.[1]?.trim();
    if (path && existsSync(path)) return path;
  }
  return null;
}

function playwrightChromiumPaths(): string[] {
  const localApp = process.env.LOCALAPPDATA?.trim();
  if (!localApp) return [];
  const root = join(localApp, "ms-playwright");
  if (!existsSync(root)) return [];
  const candidates: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith("chromium-")) continue;
    // Full Chromium only — headless shell lacks measureUserAgentSpecificMemory (krausest memory benches).
    candidates.push(
      join(root, entry.name, "chrome-win64", "chrome.exe"),
      join(root, entry.name, "chrome-win", "chrome.exe"),
      join(root, entry.name, "chrome-linux64", "chrome"),
      join(root, entry.name, "chrome-linux", "chrome"),
      join(root, entry.name, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
    );
  }
  return candidates.filter((path) => existsSync(path));
}

export function isHeadlessShellChrome(path: string): boolean {
  return /chrome-headless-shell(?:\.exe)?$/i.test(path);
}

function commonChromePaths(): string[] {
  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    const localApp = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
    return [
      join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      join(localApp, "Google", "Chrome", "Application", "chrome.exe"),
      join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    ];
  }
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
  }
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
}

let cachedChromeExecutable: string | null | undefined;

export function resetChromeExecutableCache(): void {
  cachedChromeExecutable = undefined;
}

/** Resolve a Chromium-based browser for krausest puppeteer driver. */
export function findChromeExecutable(): string | null {
  if (cachedChromeExecutable !== undefined) return cachedChromeExecutable;

  const fromEnv =
    process.env.KRAUSEST_CHROME_BINARY?.trim() ??
    process.env.CHROME_BIN?.trim() ??
    process.env.CHROME_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) {
    cachedChromeExecutable = fromEnv;
    return cachedChromeExecutable;
  }

  const candidates = [
    registryAppPath("chrome.exe"),
    registryAppPath("msedge.exe"),
    ...commonChromePaths(),
    ...playwrightChromiumPaths(),
  ].filter((path): path is string => Boolean(path));

  cachedChromeExecutable = newestExisting(candidates);
  return cachedChromeExecutable;
}

export function requireChromeExecutable(): string {
  const chrome = findChromeExecutable();
  if (!chrome) {
    throw new Error(
      [
        "Chrome/Chromium executable not found for krausest driver.",
        "Install Google Chrome, set KRAUSEST_CHROME_BINARY, or run: bunx playwright install chromium",
      ].join(" "),
    );
  }
  return chrome;
}
