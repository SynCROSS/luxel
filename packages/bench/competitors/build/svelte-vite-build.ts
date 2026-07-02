import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, unlink, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const competitorsDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = join(competitorsDir, ".svelte-build.lock");
const competitorsViteBin = join(competitorsDir, "node_modules", "vite", "bin", "vite.js");

const TRANSIENT_WIN_BUILD_RE = /EPERM|EUNKNOWN|EBUSY|ENOENT/i;
const MAX_ATTEMPTS = 8;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nodeLooksRunnable(cmd: string): boolean {
  const result = spawnSync(cmd, ["--version"], {
    shell: true,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0;
}

function resolveFnmMultishellNode(multishellPath?: string): string | null {
  const multishell = multishellPath ?? process.env.FNM_MULTISHELL_PATH;
  if (!multishell) return null;
  const node = join(multishell, process.platform === "win32" ? "node.exe" : "node");
  return existsSync(node) ? node : null;
}

function resolveFnmViaExec(): string | null {
  const result = spawnSync("fnm", ["env", "--shell", "cmd"], {
    shell: true,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0 || !result.stdout) return null;
  const match = result.stdout.match(/FNM_MULTISHELL_PATH=([^\r\n]+)/);
  if (!match?.[1]) return null;
  return resolveFnmMultishellNode(match[1].trim());
}

function resolveNodeExecutable(): string | null {
  const staticCandidates = [
    process.env.BENCH_NODE,
    resolveFnmMultishellNode(),
    resolveFnmViaExec(),
    "node",
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  for (const cmd of staticCandidates) {
    if (cmd.includes("\\") || cmd.includes("/")) {
      if (existsSync(cmd) && nodeLooksRunnable(cmd)) return cmd;
      continue;
    }
    if (nodeLooksRunnable(cmd)) return cmd;
  }

  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles;
    if (programFiles) {
      const programFilesNode = join(programFiles, "nodejs", "node.exe");
      if (existsSync(programFilesNode)) return programFilesNode;
    }
  }

  return null;
}

function viteBinForApp(root: string): string {
  const local = join(root, "node_modules", "vite", "bin", "vite.js");
  if (existsSync(local)) return local;
  return competitorsViteBin;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function clearStaleBuildLock(): Promise<void> {
  try {
    const raw = await readFile(lockPath, "utf8");
    const pid = Number(raw.trim());
    if (!Number.isFinite(pid) || !isPidAlive(pid)) {
      await unlink(lockPath);
    }
  } catch {
    /* no lock */
  }
}

async function acquireBuildLock(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      await writeFile(lockPath, `${process.pid}\n`, { flag: "wx" });
      return;
    } catch {
      await clearStaleBuildLock();
      await sleep(500);
    }
  }
  throw new Error("timed out waiting for .svelte-build.lock");
}

async function releaseBuildLock(): Promise<void> {
  await unlink(lockPath).catch(() => {});
}

async function rimrafAdapterNodeRetry(root: string): Promise<void> {
  if (process.platform !== "win32") return;
  const adapterNode = join(root, ".svelte-kit", "adapter-node");
  for (let i = 0; i < 3; i++) {
    try {
      await rm(adapterNode, { recursive: true, force: true });
      return;
    } catch {
      await sleep(300 * (i + 1));
    }
  }
}

function runNodeViteBuild(root: string): { status: number | null; output: string } {
  const env = { ...process.env, NODE_ENV: "production" };
  const node = resolveNodeExecutable();
  const viteBin = viteBinForApp(root);

  const result =
    node && existsSync(viteBin)
      ? spawnSync(node, [viteBin, "build"], {
          cwd: root,
          shell: false,
          env,
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
        })
      : spawnSync("bun", ["x", "vite", "build"], {
          cwd: root,
          shell: true,
          env,
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
        });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return { status: result.status, output };
}

function isTransientWindowsBuildError(output: string): boolean {
  return TRANSIENT_WIN_BUILD_RE.test(output);
}

/** SvelteKit prod build — Node subprocess, serialized lock, Windows FS retries (CONTEXT.md). */
export async function runSvelteKitViteBuild(root: string, label: string): Promise<void> {
  await acquireBuildLock();
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (process.platform === "win32") {
        await rimrafAdapterNodeRetry(root);
      }

      const { status, output } = runNodeViteBuild(root);
      if (status === 0) {
        if (output) process.stdout.write(output);
        console.log(`built ${label}`);
        return;
      }

      const retry =
        process.platform === "win32" &&
        isTransientWindowsBuildError(output) &&
        attempt < MAX_ATTEMPTS;

      if (retry) {
        console.warn(
          `[svelte-build] transient Windows FS error on ${label} (attempt ${attempt}/${MAX_ATTEMPTS}), retrying…`,
        );
        await sleep(attempt * 500);
        continue;
      }

      if (output) process.stderr.write(output);
      process.exit(status ?? 1);
    }
  } finally {
    await releaseBuildLock();
  }
}

export { isTransientWindowsBuildError, TRANSIENT_WIN_BUILD_RE, resolveNodeExecutable };
