import { existsSync } from "node:fs";

const CANDIDATES = [
  process.env.WINRK,
  "winrk",
  "winrk.exe",
  "C:\\Program Files (x86)\\Winrk\\winrk.exe",
  "C:\\Program Files\\Winrk\\winrk.exe",
].filter(Boolean) as string[];

export function resolveWinrk(): string {
  for (const candidate of CANDIDATES) {
    if (candidate.includes("\\") || candidate.includes("/")) {
      if (existsSync(candidate)) return candidate;
      continue;
    }
    const pathEnv = process.env.PATH ?? "";
    for (const dir of pathEnv.split(";")) {
      const full = `${dir}\\${candidate}`;
      if (existsSync(full)) return full;
    }
  }
  throw new Error(
    "winrk not found. Install from https://github.com/fomalhaut88/winrk or set WINRK=/path/to/winrk.exe",
  );
}
