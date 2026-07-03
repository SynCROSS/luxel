import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const CANDIDATES = [process.env.WRK, "wrk", "wrk.exe"].filter(Boolean) as string[];

export function resolveWrk(): string {
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
      const out = execFileSync("where.exe", ["wrk"], { encoding: "utf8" }).trim();
      const first = out.split(/\r?\n/).find((line) => line.trim().length > 0);
      if (first && existsSync(first)) return first;
    } catch {
      // not on PATH
    }
  }
  throw new Error("wrk not found. Install wrk or set WRK=/path/to/wrk");
}

export function isWrkAvailable(): boolean {
  try {
    resolveWrk();
    return true;
  } catch {
    return false;
  }
}
