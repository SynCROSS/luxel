import { availableParallelism, cpus } from "node:os";

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

function detectHardwareConcurrency(): number {
  const nav = globalThis.navigator as { hardwareConcurrency?: number } | undefined;
  if (nav?.hardwareConcurrency && nav.hardwareConcurrency > 0) {
    return nav.hardwareConcurrency;
  }
  return availableParallelism() ?? cpus().length;
}

/** WinRK `-t` default; override `WINRK_THREADS`. */
export function winrkDefaultThreads(): number {
  return parsePositiveInt(process.env.WINRK_THREADS) ?? detectHardwareConcurrency();
}

/** Render worker pool size default; override `BENCH_RENDER_WORKER_COUNT`. */
export function benchRenderWorkerCount(): number {
  return parsePositiveInt(process.env.BENCH_RENDER_WORKER_COUNT) ?? detectHardwareConcurrency();
}
