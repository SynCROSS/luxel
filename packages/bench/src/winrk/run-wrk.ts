import { spawn } from "node:child_process";
import type { WinrkOptions } from "./run.ts";
import { WINRK_DEFAULTS } from "./run.ts";
import type { WinrkStats } from "./parse.ts";
import { parseWinrkOutput } from "./parse.ts";
import { resolveWrk } from "./resolve-wrk.ts";

/** Async spawn — wrk output matches Requests/sec lines parsed by parseWinrkOutput. */
export async function runWrk(options: WinrkOptions): Promise<WinrkStats> {
  const wrk = resolveWrk();
  const duration = String(options.durationSec ?? WINRK_DEFAULTS.durationSec);
  const connections = String(options.connections ?? WINRK_DEFAULTS.connections);
  const threads = String(options.threads ?? WINRK_DEFAULTS.threads);

  const { stdout, stderr, status } = await new Promise<{
    stdout: string;
    stderr: string;
    status: number | null;
  }>((resolve, reject) => {
    const child = spawn(
      wrk,
      ["-t", threads, "-c", connections, "-d", `${duration}s`, options.url],
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
    throw new Error(`wrk failed (exit ${status}):\n${combined}`);
  }
  return parseWinrkOutput(combined);
}
