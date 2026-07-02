import { execSync } from "node:child_process";

/** Command-line substrings for stale bench subprocesses (repro chain + stack children). */
export const ORPHAN_CMD_PATTERNS = [
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

/** Regex for matching orphan bench process command lines (posix + Windows paths). */
export const ORPHAN_RE = new RegExp(
  ORPHAN_CMD_PATTERNS.map((p) => p.replace(/\//g, "[/\\\\]")).join("|"),
);

function killWindowsBenchOrphans(): number {
  const pattern = ORPHAN_CMD_PATTERNS.join("|").replace(/\//g, "[/\\\\]");
  const script = [
    "Get-CimInstance Win32_Process -Filter \"name='bun.exe' OR name='node.exe'\"",
    `| Where-Object { $_.CommandLine -match '${pattern}' }`,
    "| ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
    "| Measure-Object",
    "| Select-Object -ExpandProperty Count",
  ].join(" ");
  try {
    const out = execSync(`powershell -NoProfile -Command "${script}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return Number(out) || 0;
  } catch {
    return 0;
  }
}

function killUnixBenchOrphans(): number {
  try {
    const out = execSync(
      `ps -eo pid=,command= | grep -E '${ORPHAN_CMD_PATTERNS.join("|")}' | grep -v grep | awk '{print $1}'`,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
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

/** Best-effort kill stale bench child processes (prior crashed/aborted runs). */
export function cleanupOrphanBenchProcesses(): number {
  if (process.platform === "win32") return killWindowsBenchOrphans();
  return killUnixBenchOrphans();
}
