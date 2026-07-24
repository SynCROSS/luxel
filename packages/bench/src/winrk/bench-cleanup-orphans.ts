import { execSync } from "node:child_process";

/** WinRK repro chain + stack children. */
export const WINRK_ORPHAN_CMD_PATTERNS = [
  "stack-child-server",
  "winrk-isolated-stack",
  "winrk/serve-stack.ts",
  "winrk-run.ts",
  "winrk-repro-all",
  "bench:winrk:repro-all",
  "bench:repro",
  "vite build",
  "vinxi build",
  "next build",
] as const;

/** Krausest harness / upstream driver / server (default A). */
export const KRAUSEST_ORPHAN_CMD_PATTERNS = [
  "js-framework-benchmark",
  "webdriver-ts",
  "benchmarkRunner",
  "setup-krausest",
  "diagnose-krausest",
  "bench --krausest",
  "bench:krausest",
] as const;

/**
 * Aggressive luxel-bench-tree kill (C) — opt-in only.
 * Broader than default; may hit unrelated luxel CLI work.
 */
export const AGGRESSIVE_ORPHAN_CMD_PATTERNS = [
  "packages/luxel/src/cli.ts",
  "packages\\luxel\\src\\cli.ts",
  "luxel/src/cli.ts",
  "luxel\\src\\cli.ts",
] as const;

/** Chrome cmdline fingerprints for krausest Puppeteer / cached binaries (default B). */
export const KRAUSEST_CHROME_ORPHAN_CMD_PATTERNS = [
  "js-framework-benchmark",
  "krausest-chrome",
  "puppeteer_dev_chrome_profile",
] as const;

/** Combined default A patterns (WinRK + krausest). */
export const ORPHAN_CMD_PATTERNS = [
  ...WINRK_ORPHAN_CMD_PATTERNS,
  ...KRAUSEST_ORPHAN_CMD_PATTERNS,
] as const;

export const ORPHAN_RE = new RegExp(
  ORPHAN_CMD_PATTERNS.map((p) => p.replace(/\//g, "[/\\\\]")).join("|"),
);

export type CleanupOrphanOptions = {
  /** Aggressive luxel-bench-tree kill (C). */
  aggressive?: boolean;
};

export function isAggressiveCleanupRequested(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (argv.includes("--aggressive")) return true;
  const raw = env.BENCH_CLEANUP_AGGRESSIVE?.trim();
  return raw === "1" || raw === "true";
}

function cmdPatternAlternation(patterns: readonly string[]): string {
  return patterns.map((p) => p.replace(/\//g, "[/\\\\]")).join("|");
}

function patternToRegExp(pattern: string): RegExp {
  return new RegExp(pattern, "i");
}

/** Parse `wmic … get ProcessId,CommandLine /FORMAT:LIST` blocks. */
export function parseWmicProcessList(stdout: string): Array<{ pid: number; commandLine: string }> {
  const entries: Array<{ pid: number; commandLine: string }> = [];
  let pid: number | null = null;
  let commandLine = "";
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (pid != null && commandLine) entries.push({ pid, commandLine });
      pid = null;
      commandLine = "";
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    if (key === "processid") pid = Number(value) || null;
    else if (key === "commandline") commandLine = value;
  }
  if (pid != null && commandLine) entries.push({ pid, commandLine });
  return entries;
}

function listWindowsProcesses(names: readonly string[]): Array<{ pid: number; commandLine: string }> {
  const where = names.map((n) => `name='${n}'`).join(" or ");
  try {
    const out = execSync(`wmic process where "${where}" get ProcessId,CommandLine /FORMAT:LIST`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      timeout: 8_000,
    });
    return parseWmicProcessList(out);
  } catch {
    return [];
  }
}

function killWindowsPids(pids: readonly number[]): number {
  let killed = 0;
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, {
        stdio: "ignore",
        windowsHide: true,
        timeout: 5_000,
      });
      killed += 1;
    } catch {
      /* already dead */
    }
  }
  return killed;
}

function killWindowsByCmdPatterns(names: readonly string[], pattern: string): number {
  const re = patternToRegExp(pattern);
  const matches = listWindowsProcesses(names)
    .filter((p) => re.test(p.commandLine))
    .map((p) => p.pid);
  return killWindowsPids(matches);
}

function killUnixByCmdPatterns(pattern: string): number {
  try {
    const out = execSync(
      `ps -eo pid=,command= | grep -E '${pattern}' | grep -v grep | awk '{print $1}'`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10_000 },
    );
    const pids = out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), "SIGTERM");
      } catch {
        /* already dead */
      }
    }
    return pids.length;
  } catch {
    return 0;
  }
}

/**
 * Best-effort kill stale bench child processes (WinRK + krausest).
 * Default = A (cmdline bun/node) + B (krausest chrome cmdline fingerprints).
 * Aggressive C via `aggressive: true` / `--aggressive` / `BENCH_CLEANUP_AGGRESSIVE=1`.
 */
export function cleanupOrphanBenchProcesses(opts?: CleanupOrphanOptions): number {
  const aggressive = opts?.aggressive ?? isAggressiveCleanupRequested();
  const bunNodePatterns = [
    ...WINRK_ORPHAN_CMD_PATTERNS,
    ...KRAUSEST_ORPHAN_CMD_PATTERNS,
    ...(aggressive ? AGGRESSIVE_ORPHAN_CMD_PATTERNS : []),
  ];
  const bunNodeAlt = cmdPatternAlternation(bunNodePatterns);
  const chromeAlt = cmdPatternAlternation(KRAUSEST_CHROME_ORPHAN_CMD_PATTERNS);

  if (process.platform === "win32") {
    let killed = 0;
    killed += killWindowsByCmdPatterns(["bun.exe", "node.exe"], bunNodeAlt);
    killed += killWindowsByCmdPatterns(["chrome.exe", "chromium.exe", "msedge.exe"], chromeAlt);
    return killed;
  }

  let killed = 0;
  killed += killUnixByCmdPatterns(bunNodeAlt);
  killed += killUnixByCmdPatterns(
    `(chrome|chromium|msedge).*(${KRAUSEST_CHROME_ORPHAN_CMD_PATTERNS.join("|")})`,
  );
  return killed;
}
