import { spawn } from "node:child_process";
import { parseWinrkOutput, type WinrkStats } from "./parse.ts";
import { resolveWinrk } from "./resolve.ts";
import { winrkDefaultThreads } from "./hardware-concurrency.ts";

export type WinrkOptions = {
  url: string;
  durationSec?: number;
  connections?: number;
  threads?: number;
  _retriedEmpty?: boolean;
};

export const WINRK_DEFAULTS = {
  durationSec: Number(process.env.WINRK_DURATION ?? "15"),
  connections: Number(process.env.WINRK_CONNECTIONS ?? "400"),
  get threads() {
    return winrkDefaultThreads();
  },
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
  try {
    return parseWinrkOutput(combined);
  } catch (err) {
    const duration = Number(options.durationSec ?? WINRK_DEFAULTS.durationSec);
    if (duration < 3 && /missing rps|empty result/i.test(String(err))) {
      return runWinrk({ ...options, durationSec: 3 });
    }
    if (!options._retriedEmpty && /missing rps|empty result/i.test(String(err))) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      return runWinrk({ ...options, _retriedEmpty: true });
    }
    throw err;
  }
}
