import { spawn } from "node:child_process";
import { parseWinrkOutput, type WinrkStats } from "./parse.ts";
import { resolveWinrk } from "./resolve.ts";

export type WinrkOptions = {
  url: string;
  durationSec?: number;
  connections?: number;
  threads?: number;
};

export const WINRK_DEFAULTS = {
  durationSec: Number(process.env.WINRK_DURATION ?? "15"),
  connections: Number(process.env.WINRK_CONNECTIONS ?? "400"),
  threads: Number(process.env.WINRK_THREADS ?? "8"),
};

/** Async spawn — spawnSync blocks Bun event loop and starves the in-process HTTP server. */
export async function runWinrk(options: WinrkOptions): Promise<WinrkStats> {
  const winrk = resolveWinrk();
  const duration = String(options.durationSec ?? WINRK_DEFAULTS.durationSec);
  const connections = String(options.connections ?? WINRK_DEFAULTS.connections);
  const threads = String(options.threads ?? WINRK_DEFAULTS.threads);

  const { stdout, stderr, status } = await new Promise<{
    stdout: string;
    stderr: string;
    status: number | null;
  }>((resolve, reject) => {
    const child = spawn(winrk, [options.url, "-d", duration, "-c", connections, "-t", threads], {
      windowsHide: true,
    });
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
    throw new Error(`winrk failed (exit ${status}):\n${combined}`);
  }
  return parseWinrkOutput(combined);
}
