import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { loadLuxelConfig, resolveAppPaths } from "./config/load.ts";
import { findDenoExecutable } from "./util/find-deno.ts";

export type ProdRuntime = "node" | "deno";

export async function serveProd(
  repoRoot: string,
  appDir: string,
  runtime: ProdRuntime,
): Promise<void> {
  const appRoot = join(repoRoot, appDir);
  const config = await loadLuxelConfig(appRoot);
  const paths = resolveAppPaths(repoRoot, appDir, config);
  const scriptName = runtime === "node" ? "start-node.mjs" : "start-deno.mjs";
  const startScript = join(paths.outDir, "server", scriptName);
  const serverCwd = join(paths.outDir, "server");

  if (!existsSync(startScript)) {
    throw new Error(
      `Missing ${startScript}. Run \`luxel build\` from the app directory first.`,
    );
  }

  if (runtime === "node") {
    await runProcess(process.execPath, [startScript], serverCwd);
    return;
  }

  const deno = findDenoExecutable();
  if (!deno) {
    throw new Error(
      [
        "Deno not found on PATH or in the default install location.",
        "Install: https://docs.deno.com/runtime/getting_started/installation/",
        `Windows default: ${join(process.env.USERPROFILE ?? "~", ".deno", "bin", "deno.exe")}`,
        "Add that folder to PATH, or run: luxel serve deno (resolves install dir automatically).",
      ].join("\n"),
    );
  }

  await runProcess(
    deno,
    ["run", "--allow-net", "--allow-read", "--allow-env", startScript],
    serverCwd,
  );
}

function runProcess(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}
