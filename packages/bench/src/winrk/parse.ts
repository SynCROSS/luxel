export type WinrkStats = {
  requestsPerSec: number;
  transferPerSec?: string;
  latencyMinMs?: number;
  latencyP50Ms?: number;
  latencyAvgMs?: number;
  latencyMaxMs?: number;
  errorRatePercent?: number;
  totalRequests?: number;
  totalErrors?: number;
  raw: string;
};

export function parseWinrkOutput(stdout: string): WinrkStats {
  const rpsMatch =
    stdout.match(/Requests\/sec:\s+([\d.]+)/i) ??
    stdout.match(/rps:\s+([\d.]+)\s+requests per sec/i);
  if (!rpsMatch) {
    throw new Error(`winrk output missing rps:\n${stdout}`);
  }
  const transferMatch =
    stdout.match(/Transfer\/sec:\s+(.+)/i) ?? stdout.match(/transfers:\s+(.+)/i);
  const minMatch = stdout.match(/latency min:\s+([\d.]+)(ms|µs|us|s)/i);
  const medianMatch = stdout.match(/latency median:\s+([\d.]+)(ms|µs|us|s)/i);
  const avgMatch =
    stdout.match(/Latency\s+([\d.]+)(ms|µs|us|s)/i) ??
    stdout.match(/latency average:\s+([\d.]+)(ms|µs|us|s)/i);
  const maxMatch = stdout.match(/latency max:\s+([\d.]+)(ms|µs|us|s)/i);
  const errorMatch = stdout.match(/error percentage:\s+([\d.]+)%/i);
  const totalMatch = stdout.match(/total:\s+(\d+)\s+requests/i);
  const totalErrorsMatch = stdout.match(/errors:\s+(\d+)\s+errors/i);

  return {
    requestsPerSec: Number(rpsMatch[1]),
    transferPerSec: transferMatch?.[1]?.trim(),
    latencyMinMs: minMatch ? toMs(Number(minMatch[1]), minMatch[2]!) : undefined,
    latencyP50Ms: medianMatch ? toMs(Number(medianMatch[1]), medianMatch[2]!) : undefined,
    latencyAvgMs: avgMatch ? toMs(Number(avgMatch[1]), avgMatch[2]!) : undefined,
    latencyMaxMs: maxMatch ? toMs(Number(maxMatch[1]), maxMatch[2]!) : undefined,
    errorRatePercent: errorMatch ? Number(errorMatch[1]) : undefined,
    totalRequests: totalMatch ? Number(totalMatch[1]) : undefined,
    totalErrors: totalErrorsMatch ? Number(totalErrorsMatch[1]) : undefined,
    raw: stdout,
  };
}

function toMs(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === "µs" || u === "us") return value / 1000;
  if (u === "s") return value * 1000;
  return value;
}
