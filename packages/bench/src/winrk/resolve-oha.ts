import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const CANDIDATES = [process.env.OHA, "oha", "oha.exe"].filter(Boolean) as string[];

export function resolveOha(): string {
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
      const out = execFileSync("where.exe", ["oha"], { encoding: "utf8" }).trim();
      const first = out.split(/\r?\n/).find((line) => line.trim().length > 0);
      if (first && existsSync(first)) return first;
    } catch {
      // not on PATH
    }
  }
  throw new Error(
    "oha not found. Install from https://github.com/hatoo/oha or set OHA=/path/to/oha",
  );
}

export function isOhaAvailable(): boolean {
  try {
    resolveOha();
    return true;
  } catch {
    return false;
  }
}
