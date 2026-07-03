import type { WinrkStats } from "./parse.ts";

function parseLatencyMs(raw: string): number {
  const m = raw.trim().match(/^([\d.]+)\s*(us|µs|ms|s)$/i);
  if (!m) return Number(raw) || 0;
  const value = Number(m[1]);
  const unit = m[2]!.toLowerCase();
  if (unit === "us" || unit === "µs") return value / 1000;
  if (unit === "s") return value * 1000;
  return value;
}

/** Parse oha plain-text summary into WinRK-shaped stats. */
export function parseOhaOutput(stdout: string): WinrkStats {
  const rpsMatch = stdout.match(/Requests\/sec:\s+([\d.]+)/i);
  if (!rpsMatch) {
    throw new Error(`oha output missing Requests/sec:\n${stdout}`);
  }

  const successMatch = stdout.match(/Success rate:\s+([\d.]+)%/i);
  const successRate = successMatch ? Number(successMatch[1]) : 100;
  const slowestMatch = stdout.match(/Slowest:\s+([\d.]+)\s*ms/i);
  const fastestMatch = stdout.match(/Fastest:\s+([\d.]+)\s*ms/i);
  const averageMatch = stdout.match(/Average:\s+([\d.]+)\s*ms/i);
  const p50Match = stdout.match(/50\.00%\s+in\s+([\d.]+)\s*ms/i);
  const p99Match = stdout.match(/99\.00%\s+in\s+([\d.]+)\s*ms/i);

  let totalRequests = 0;
  let totalErrors = 0;
  for (const match of stdout.matchAll(/\[(\d{3})\]\s+(\d+)\s+responses?/gi)) {
    const code = Number(match[1]);
    const count = Number(match[2]);
    totalRequests += count;
    if (code < 200 || code >= 300) totalErrors += count;
  }

  // Deadline aborts at -z end are expected; oha still reports Success rate: 100%.
  const errorRatePercent =
    successRate < 100
      ? Number((100 - successRate).toFixed(4))
      : totalRequests > 0
        ? Number(((totalErrors / totalRequests) * 100).toFixed(4))
        : 0;

  return {
    requestsPerSec: Number(rpsMatch[1]),
    latencyMinMs: fastestMatch ? parseLatencyMs(fastestMatch[1]!) : undefined,
    latencyP50Ms: p50Match ? parseLatencyMs(p50Match[1]!) : averageMatch ? parseLatencyMs(averageMatch[1]!) : undefined,
    latencyAvgMs: averageMatch ? parseLatencyMs(averageMatch[1]!) : undefined,
    latencyMaxMs: slowestMatch ? parseLatencyMs(slowestMatch[1]!) : p99Match ? parseLatencyMs(p99Match[1]!) : undefined,
    errorRatePercent,
    totalRequests: totalRequests > 0 ? totalRequests : undefined,
    totalErrors: totalErrors > 0 ? totalErrors : errorRatePercent > 0 ? 1 : 0,
    raw: stdout,
  };
}
