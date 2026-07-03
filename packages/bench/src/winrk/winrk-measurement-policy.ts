import type { WinrkStats } from "./parse.ts";
import { isWindowsBenchHost } from "./bench-latency-config.ts";

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return undefined;
  return Math.floor(value);
}

/** True when WinRK reported nonzero errors (raw count or rounded rate). */
export function winrkMeasurementHasErrors(stats: WinrkStats): boolean {
  if ((stats.totalErrors ?? 0) > 0) return true;
  return (stats.errorRatePercent ?? 0) > 0;
}

/** WinRK measurement attempts per stack server start (Windows localhost needs retries). */
export function benchWinrkMeasurementRetryAttempts(): number {
  const fromEnv = parsePositiveInt(process.env.BENCH_WINRK_RETRY_ATTEMPTS);
  if (fromEnv !== undefined) return fromEnv;
  return isWindowsBenchHost() ? 3 : 1;
}

export function shouldRetryWinrkMeasurement(
  attempt: number,
  maxAttempts = benchWinrkMeasurementRetryAttempts(),
): boolean {
  return attempt < maxAttempts;
}
