import type { WinrkStats } from "./parse.ts";
import { isBombardierAvailable, resolveBombardier } from "./resolve-bombardier.ts";
import { isOhaAvailable, resolveOha } from "./resolve-oha.ts";
import { isWrkAvailable, resolveWrk } from "./resolve-wrk.ts";
import { resolveWinrk } from "./resolve.ts";
import { runBombardier } from "./run-bombardier.ts";
import { runOha } from "./run-oha.ts";
import { runWinrk, type WinrkOptions } from "./run.ts";
import { runWrk } from "./run-wrk.ts";

export type BenchLoadTester = "oha" | "bombardier" | "wrk" | "winrk";

export type BenchLoadTesterMeta = {
  name: BenchLoadTester;
  path: string;
};

/** Preferred auto order: oha → bombardier → wrk → winrk. */
export const BENCH_LOAD_TESTER_AUTO_CHAIN: readonly BenchLoadTester[] = [
  "oha",
  "bombardier",
  "wrk",
  "winrk",
];

function isTesterAvailable(tester: BenchLoadTester): boolean {
  switch (tester) {
    case "oha":
      return isOhaAvailable();
    case "bombardier":
      return isBombardierAvailable();
    case "wrk":
      return isWrkAvailable();
    case "winrk":
      try {
        resolveWinrk();
        return true;
      } catch {
        return false;
      }
    default: {
      const _exhaustive: never = tester;
      return _exhaustive;
    }
  }
}

function resolveTesterPath(tester: BenchLoadTester): string {
  switch (tester) {
    case "oha":
      return resolveOha();
    case "bombardier":
      return resolveBombardier();
    case "wrk":
      return resolveWrk();
    case "winrk":
      return resolveWinrk();
    default: {
      const _exhaustive: never = tester;
      return _exhaustive;
    }
  }
}

export function resolveBenchLoadTester(): BenchLoadTester {
  const raw = process.env.BENCH_LOAD_TESTER?.trim().toLowerCase();
  if (raw === "oha") return "oha";
  if (raw === "bombardier") return "bombardier";
  if (raw === "wrk") return "wrk";
  if (raw === "winrk") return "winrk";
  for (const tester of BENCH_LOAD_TESTER_AUTO_CHAIN) {
    if (isTesterAvailable(tester)) return tester;
  }
  return "winrk";
}

export function resolveBenchLoadTesterMeta(): BenchLoadTesterMeta {
  const name = resolveBenchLoadTester();
  return {
    name,
    path: resolveTesterPath(name),
  };
}

export type BenchLoadOptions = WinrkOptions & {
  tester?: BenchLoadTester;
};

export async function runBenchLoadTest(options: BenchLoadOptions): Promise<WinrkStats> {
  const tester = options.tester ?? resolveBenchLoadTester();
  switch (tester) {
    case "oha":
      return runOha(options);
    case "bombardier":
      return runBombardier(options);
    case "wrk":
      return runWrk(options);
    case "winrk":
      return runWinrk(options);
    default: {
      const _exhaustive: never = tester;
      return _exhaustive;
    }
  }
}

/** Next load tester in auto chain when current run reports errors. */
export function nextFallbackLoadTester(current: BenchLoadTester): BenchLoadTester | null {
  const idx = BENCH_LOAD_TESTER_AUTO_CHAIN.indexOf(current);
  if (idx < 0) return null;
  for (let i = idx + 1; i < BENCH_LOAD_TESTER_AUTO_CHAIN.length; i++) {
    const candidate = BENCH_LOAD_TESTER_AUTO_CHAIN[i]!;
    if (isTesterAvailable(candidate)) return candidate;
  }
  return null;
}

/** @deprecated Use nextFallbackLoadTester */
export function canFallbackToBombardier(tester: BenchLoadTester): boolean {
  return nextFallbackLoadTester(tester) !== null;
}
