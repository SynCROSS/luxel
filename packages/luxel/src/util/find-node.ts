import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

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

function nodeMajorVersion(nodePath: string): number | null {
  const result = spawnSync(nodePath, ["-v"], {
    encoding: "utf8",
    windowsHide: true,
    shell: process.platform === "win32",
  });
  const match = result.stdout.trim().match(/^v(\d+)/);
  return match ? Number(match[1]) : null;
}

function collectNodeCandidates(): string[] {
  const candidates: string[] = [];
  const pushDir = (dir: string) => {
    const node = join(dir, process.platform === "win32" ? "node.exe" : "node");
    if (existsSync(node)) candidates.push(node);
  };

  const fromWhere = nodeFromWhere();
  if (fromWhere) candidates.push(fromWhere);

  const fnmRoots = [
    process.env.FNM_DIR?.trim(),
    join(homedir(), ".fnm", "node-versions"),
    join(process.env.LOCALAPPDATA ?? "", "fnm", "node-versions"),
    join(process.env.APPDATA ?? "", "fnm", "node-versions"),
  ].filter((path): path is string => Boolean(path));
  for (const root of fnmRoots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      pushDir(join(root, entry.name, "installation"));
    }
  }

  const nvmHome = process.env.NVM_HOME?.trim() ?? join(homedir(), "AppData", "Roaming", "nvm");
  if (existsSync(nvmHome)) {
    for (const entry of readdirSync(nvmHome, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      pushDir(join(nvmHome, entry.name));
    }
  }

  const programFiles = join(process.env.ProgramFiles ?? "C:\\Program Files", "nodejs", "node.exe");
  if (existsSync(programFiles)) candidates.push(programFiles);

  return [...new Set(candidates)];
}

function nodeFromFnmExec(): string | null {
  const fnm = spawnSync("fnm", ["exec", "--using=20", "node", "-p", "process.execPath"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    windowsHide: true,
  });
  const path = fnm.stdout.trim();
  return path && existsSync(path) ? path : null;
}

/** Prefer Node 20 LTS for native npm addons (e.g. halogen/spago better-sqlite3). */
export function findNode20Executable(): string | null {
  const fromFnmExec = nodeFromFnmExec();
  if (fromFnmExec && nodeMajorVersion(fromFnmExec) === 20) return fromFnmExec;
  for (const candidate of collectNodeCandidates()) {
    if (nodeMajorVersion(candidate) === 20) return candidate;
  }
  return null;
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

/** Resolve npm next to a discovered node binary (fnm/nvm shells often omit npm from PATH). */
let cachedNpmExecutable: string | null | undefined;

export function findNpmExecutable(): string | null {
  if (cachedNpmExecutable !== undefined) return cachedNpmExecutable;
  cachedNpmExecutable = resolveNpmExecutable();
  return cachedNpmExecutable;
}

function resolveNpmExecutable(): string | null {
  const node = findNodeExecutable();
  if (node && node !== "node") {
    const dir = dirname(node);
    const npmCmd = join(dir, process.platform === "win32" ? "npm.cmd" : "npm");
    if (existsSync(npmCmd)) return npmCmd;
  }

  const command =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/c", "where npm"], { encoding: "utf8" })
      : spawnSync("which", ["npm"], { encoding: "utf8" });
  if (command.status === 0) {
    const first = command.stdout.trim().split(/\r?\n/).find(Boolean)?.trim();
    if (first && existsSync(first)) return first;
  }

  const direct = spawnSync("npm", ["-v"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (direct.status === 0) return "npm";

  return null;
}

export { requireNodeExecutable };
