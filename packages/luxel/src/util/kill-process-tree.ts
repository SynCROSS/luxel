import { execSync } from "node:child_process";

/** Best-effort kill of a process and its descendants (Windows: taskkill /T). */
export function killProcessTree(pid: number | undefined | null): void {
  if (pid == null || pid <= 0) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, {
        stdio: "ignore",
        windowsHide: true,
        timeout: 5_000,
      });
    } catch {
      /* already dead or timed out */
    }
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already dead */
    }
  }
}
