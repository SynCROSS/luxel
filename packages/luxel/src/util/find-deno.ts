import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** Resolve deno executable when not on PATH (common on Windows after install). */
export function findDenoExecutable(): string | null {
  const fromEnv = process.env.DENO_INSTALL?.trim();
  if (fromEnv) {
    const candidate = join(fromEnv, "bin", process.platform === "win32" ? "deno.exe" : "deno");
    if (existsSync(candidate)) return candidate;
  }

  const home = homedir();
  const winExe = process.platform === "win32" ? "deno.exe" : "deno";
  const localAppData = process.env.LOCALAPPDATA?.trim();
  const candidates = [
    join(home, ".deno", "bin", winExe),
    join(home, ".local", "bin", "deno"),
    ...(localAppData ? [join(localAppData, "deno", winExe)] : []),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}
