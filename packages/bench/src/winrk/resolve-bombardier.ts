import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const CANDIDATES = [
  process.env.BOMBARDIER,
  "bombardier",
  "bombardier.exe",
].filter(Boolean) as string[];

export function resolveBombardier(): string {
  for (const candidate of CANDIDATES) {
    if (candidate.includes("\\") || candidate.includes("/")) {
      if (existsSync(candidate)) return candidate;
      continue;
    }
    const pathEnv = process.env.PATH ?? "";
    const sep = process.platform === "win32" ? ";" : ":";
    for (const dir of pathEnv.split(sep)) {
      const full = `${dir}${process.platform === "win32" ? "\\" : "/"}${candidate}`;
      if (existsSync(full)) return full;
    }
  }
  if (process.platform === "win32") {
    try {
      const out = execFileSync("where.exe", ["bombardier"], { encoding: "utf8" }).trim();
      const first = out.split(/\r?\n/).find((line) => line.trim().length > 0);
      if (first && existsSync(first)) return first;
    } catch {
      // not on PATH
    }
  }
  throw new Error(
    "bombardier not found. Install from https://github.com/codesenberg/bombardier or set BOMBARDIER=/path/to/bombardier",
  );
}

export function isBombardierAvailable(): boolean {
  try {
    resolveBombardier();
    return true;
  } catch {
    return false;
  }
}
