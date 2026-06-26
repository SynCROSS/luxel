import type { WinrkBenchResult } from "./registry.ts";

export type WinrkStackProgressOpts = {
  isolated?: boolean;
};

function stackPrefix(
  index: number,
  total: number,
  stackId: string,
  opts?: WinrkStackProgressOpts,
): string {
  const mode = opts?.isolated ? " (isolated)" : "";
  return `[${index + 1}/${total}] ${stackId}${mode}`;
}

export function formatWinrkStackRunning(
  index: number,
  total: number,
  stackId: string,
  opts?: WinrkStackProgressOpts,
): string {
  return `${stackPrefix(index, total, stackId, opts)}: running…`;
}

export function formatWinrkStackProgress(
  index: number,
  total: number,
  row: WinrkBenchResult,
  opts?: WinrkStackProgressOpts,
): string {
  const prefix = stackPrefix(index, total, row.id, opts);
  if (row.status === "ok") {
    const rpsLabel = `${row.requestsPerSec.toFixed(2)} rps`;
    const p50Label =
      row.latencyP50Ms !== undefined ? `, p50 ${row.latencyP50Ms.toFixed(2)}ms` : "";
    return `${prefix}: ok — ${rpsLabel}${p50Label}`;
  }
  if (row.status === "pending") {
    return `${prefix}: pending — ${row.reason}`;
  }
  return `${prefix}: error — ${row.reason}`;
}

function writeProgressLine(line: string, finalize: boolean): void {
  if (process.stderr.isTTY) {
    process.stderr.write(finalize ? `\r${line}\n` : `\r${line}`);
    return;
  }
  if (finalize) {
    console.error(line);
  }
}

export function logWinrkStackRunning(
  index: number,
  total: number,
  stackId: string,
  opts?: WinrkStackProgressOpts,
): void {
  writeProgressLine(formatWinrkStackRunning(index, total, stackId, opts), false);
}

export function logWinrkStackProgress(
  index: number,
  total: number,
  row: WinrkBenchResult,
  opts?: WinrkStackProgressOpts,
): void {
  writeProgressLine(formatWinrkStackProgress(index, total, row, opts), true);
}
