import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function newestExisting(paths: string[]): string | null {
  let best: { path: string; mtime: number } | null = null;
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const mtime = statSync(path).mtimeMs;
    if (!best || mtime > best.mtime) best = { path, mtime };
  }
  return best?.path ?? null;
}

function nodeFromFnmMultishells(): string | null {
  const localApp = process.env.LOCALAPPDATA?.trim();
  if (!localApp) return null;
  const root = join(localApp, "fnm_multishells");
  if (!existsSync(root)) return null;
  const candidates: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    candidates.push(join(root, entry.name, process.platform === "win32" ? "node.exe" : "node"));
  }
  return newestExisting(candidates);
}

function nodeFromNvm(): string | null {
  const nvmHome = process.env.NVM_HOME?.trim() ?? join(homedir(), "AppData", "Roaming", "nvm");
  if (!existsSync(nvmHome)) return null;
  const symlink =
    process.env.NVM_SYMLINK?.trim() ??
    join(process.env.ProgramFiles ?? "C:\\Program Files", "nodejs", "node.exe");
  if (existsSync(symlink)) return symlink;
  const candidates: string[] = [];
  for (const entry of readdirSync(nvmHome, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    candidates.push(join(nvmHome, entry.name, process.platform === "win32" ? "node.exe" : "node"));
  }
  return newestExisting(candidates);
}

function nodeFromWhere(): string | null {
  const command =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/c", "where node"], { encoding: "utf8" })
      : spawnSync("which", ["node"], { encoding: "utf8" });
  if (command.status !== 0) return null;
  const first = command.stdout.trim().split(/\r?\n/).find(Boolean)?.trim();
  return first && existsSync(first) ? first : null;
}

/** Resolve node executable when plain `node` is not on PATH (common on Windows shells). */
let cachedNodeExecutable: string | null | undefined;

export function findNodeExecutable(): string | null {
  if (cachedNodeExecutable !== undefined) return cachedNodeExecutable;
  cachedNodeExecutable = resolveNodeExecutable();
  return cachedNodeExecutable;
}

function resolveNodeExecutable(): string | null {
  const fromWhere = nodeFromWhere();
  if (fromWhere) return fromWhere;

  const fromFnm = nodeFromFnmMultishells();
  if (fromFnm) return fromFnm;

  const fromNvm = nodeFromNvm();
  if (fromNvm) return fromNvm;

  const fromEnv = process.env.npm_node_execpath?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const direct = spawnSync("node", ["-v"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (direct.status === 0) return "node";

  const programFiles = join(process.env.ProgramFiles ?? "C:\\Program Files", "nodejs", "node.exe");
  if (existsSync(programFiles)) return programFiles;

  return null;
}

function requireNodeExecutable(): string {
  const node = findNodeExecutable();
  if (!node) {
    throw new Error("node executable not found — install Node 20+ or expose it on PATH for host matrix tests");
  }
  return node;
}

export { requireNodeExecutable };
