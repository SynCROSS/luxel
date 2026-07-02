import { spawn } from "node:child_process";
import type { WinrkOptions } from "./run.ts";
import { WINRK_DEFAULTS } from "./run.ts";
import type { WinrkStats } from "./parse.ts";
import { parseBombardierOutput } from "./parse-bombardier.ts";
import { resolveBombardier } from "./resolve-bombardier.ts";

/** Async spawn — keeps Bun event loop free for in-process servers under load. */
export async function runBombardier(options: WinrkOptions): Promise<WinrkStats> {
  const bombardier = resolveBombardier();
  const duration = String(options.durationSec ?? WINRK_DEFAULTS.durationSec);
  const connections = String(options.connections ?? WINRK_DEFAULTS.connections);
  const url = options.url.endsWith("/") ? options.url : `${options.url}/`;

  const { stdout, stderr, status } = await new Promise<{
    stdout: string;
    stderr: string;
    status: number | null;
  }>((resolve, reject) => {
    const child = spawn(
      bombardier,
      // -p r = result stats only (no progress bar). Never pass -q/--no-print — parser needs Reqs/sec.
      ["-c", connections, "-d", `${duration}s`, "-l", url, "-p", "r"],
      { windowsHide: true },
    );
    let out = "";
    let err = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout: out, stderr: err, status: code }));
  });

  const combined = `${stdout}${stderr}`;
  if (status !== 0) {
    throw new Error(`bombardier failed (exit ${status}):\n${combined}`);
  }
  return parseBombardierOutput(combined);
}
