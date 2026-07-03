import { spawn } from "node:child_process";
import type { WinrkOptions } from "./run.ts";
import { WINRK_DEFAULTS } from "./run.ts";
import type { WinrkStats } from "./parse.ts";
import { parseOhaOutput } from "./parse-oha.ts";
import { resolveOha } from "./resolve-oha.ts";

function spawnEnvWithoutNoColor(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.NO_COLOR;
  delete env.FORCE_COLOR;
  return env;
}

/** Async spawn — keeps Bun event loop free for in-process servers under load. */
export async function runOha(options: WinrkOptions): Promise<WinrkStats> {
  const oha = resolveOha();
  const duration = String(options.durationSec ?? WINRK_DEFAULTS.durationSec);
  const connections = String(options.connections ?? WINRK_DEFAULTS.connections);

  const { stdout, stderr, status } = await new Promise<{
    stdout: string;
    stderr: string;
    status: number | null;
  }>((resolve, reject) => {
    const child = spawn(
      oha,
      ["--no-tui", "-z", `${duration}s`, "-c", connections, options.url],
      { windowsHide: true, env: spawnEnvWithoutNoColor() },
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
    throw new Error(`oha failed (exit ${status}):\n${combined}`);
  }
  return parseOhaOutput(combined);
}
