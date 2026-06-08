export type WinrkStats = {
  requestsPerSec: number;
  transferPerSec?: string;
  latencyAvgMs?: number;
  latencyStdevMs?: number;
  latencyMaxMs?: number;
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
  const avgMatch =
    stdout.match(/Latency\s+([\d.]+)(ms|µs|us|s)/i) ??
    stdout.match(/latency average:\s+([\d.]+)(ms|µs|us|s)/i);
  const maxMatch = stdout.match(/latency max:\s+([\d.]+)(ms|µs|us|s)/i);

  return {
    requestsPerSec: Number(rpsMatch[1]),
    transferPerSec: transferMatch?.[1]?.trim(),
    latencyAvgMs: avgMatch ? toMs(Number(avgMatch[1]), avgMatch[2]!) : undefined,
    latencyMaxMs: maxMatch ? toMs(Number(maxMatch[1]), maxMatch[2]!) : undefined,
    raw: stdout,
  };
}

function toMs(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === "µs" || u === "us") return value / 1000;
  if (u === "s") return value * 1000;
  return value;
}
