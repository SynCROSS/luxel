import type { WinrkStats } from "./parse.ts";
import { isBombardierAvailable, resolveBombardier } from "./resolve-bombardier.ts";
import { resolveWinrk } from "./resolve.ts";
import { runBombardier } from "./run-bombardier.ts";
import { runWinrk, type WinrkOptions } from "./run.ts";

export type BenchLoadTester = "winrk" | "bombardier";

export type BenchLoadTesterMeta = {
  name: BenchLoadTester;
  path: string;
};

export function resolveBenchLoadTester(): BenchLoadTester {
  const raw = process.env.BENCH_LOAD_TESTER?.trim().toLowerCase();
  if (raw === "bombardier") return "bombardier";
  if (raw === "winrk") return "winrk";
  // auto (default): bombardier when on PATH, else winrk
  if (isBombardierAvailable()) return "bombardier";
  return "winrk";
}

export function resolveBenchLoadTesterMeta(): BenchLoadTesterMeta {
  const name = resolveBenchLoadTester();
  return {
    name,
    path: name === "bombardier" ? resolveBombardier() : resolveWinrk(),
  };
}

export type BenchLoadOptions = WinrkOptions & {
  tester?: BenchLoadTester;
};

export async function runBenchLoadTest(options: BenchLoadOptions): Promise<WinrkStats> {
  const tester = options.tester ?? resolveBenchLoadTester();
  if (tester === "bombardier") return runBombardier(options);
  return runWinrk(options);
}

export function canFallbackToBombardier(tester: BenchLoadTester): boolean {
  return tester === "winrk" && isBombardierAvailable();
}
