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

/** Parse bombardier plain-text result block into WinRK-shaped stats. */
export function parseBombardierOutput(stdout: string): WinrkStats {
  const rpsMatch = stdout.match(/Reqs\/sec\s+([\d.]+)/i);
  if (!rpsMatch) {
    throw new Error(`bombardier output missing Reqs/sec:\n${stdout}`);
  }

  const latencyLine = stdout.match(/Latency\s+([\d.]+\s*(?:us|µs|ms|s))\s+([\d.]+\s*(?:us|µs|ms|s))\s+([\d.]+\s*(?:us|µs|ms|s))/i);
  const p50Match = stdout.match(/50%\s+([\d.]+\s*(?:us|µs|ms|s))/i);
  const codesMatch = stdout.match(
    /1xx\s*-\s*(\d+),\s*2xx\s*-\s*(\d+),\s*3xx\s*-\s*(\d+),\s*4xx\s*-\s*(\d+),\s*5xx\s*-\s*(\d+)/i,
  );
  const othersMatch = stdout.match(/others\s*-\s*(\d+)/i);

  const req1xx = codesMatch ? Number(codesMatch[1]) : 0;
  const req2xx = codesMatch ? Number(codesMatch[2]) : 0;
  const req3xx = codesMatch ? Number(codesMatch[3]) : 0;
  const req4xx = codesMatch ? Number(codesMatch[4]) : 0;
  const req5xx = codesMatch ? Number(codesMatch[5]) : 0;
  const others = othersMatch ? Number(othersMatch[1]) : 0;
  const totalRequests = req1xx + req2xx + req3xx + req4xx + req5xx + others;
  const totalErrors = req1xx + req3xx + req4xx + req5xx + others;
  const errorRatePercent =
    totalRequests > 0 ? Number(((totalErrors / totalRequests) * 100).toFixed(4)) : 0;

  return {
    requestsPerSec: Number(rpsMatch[1]),
    latencyAvgMs: latencyLine ? parseLatencyMs(latencyLine[1]!) : undefined,
    latencyP50Ms: p50Match ? parseLatencyMs(p50Match[1]!) : latencyLine ? parseLatencyMs(latencyLine[1]!) : undefined,
    latencyMaxMs: latencyLine ? parseLatencyMs(latencyLine[3]!) : undefined,
    errorRatePercent,
    totalRequests,
    totalErrors,
    raw: stdout,
  };
}
