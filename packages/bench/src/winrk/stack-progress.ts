import type { WinrkBenchResult } from "./registry.ts";

export function formatWinrkStackProgress(
  index: number,
  total: number,
  row: WinrkBenchResult,
): string {
  const prefix = `[${index + 1}/${total}] ${row.id}`;
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
