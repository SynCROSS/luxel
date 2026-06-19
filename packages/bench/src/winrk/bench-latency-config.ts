import { waitForServerReady } from "@luxel/luxel/bench";
import { releaseBetweenStacks } from "./between-stacks.ts";

function parseNonNegativeInt(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.floor(value);
}

export function isWindowsBenchHost(): boolean {
  return process.platform === "win32";
}

/** Post-winrk histogram size; lower Windows default — localhost recovers slower after `-c400`. */
export function benchLatencySampleCount(): number {
  const fromEnv = parseNonNegativeInt(process.env.BENCH_LATENCY_SAMPLES);
  if (fromEnv !== undefined) return fromEnv;
  return isWindowsBenchHost() ? 1000 : 5000;
}

/** Pause + probe before post-winrk latency fetches (Windows socket exhaustion after winrk). */
export function postWinrkCooldownMs(): number {
  const fromEnv = parseNonNegativeInt(process.env.BENCH_POST_WINRK_COOLDOWN_MS);
  if (fromEnv !== undefined) return fromEnv;
  return isWindowsBenchHost() ? 5000 : 1000;
}

export function benchLatencyConcurrency(): number {
  const fromEnv = parseNonNegativeInt(process.env.BENCH_LATENCY_CONCURRENCY);
  if (fromEnv !== undefined && fromEnv > 0) return fromEnv;
  return isWindowsBenchHost() ? 10 : 50;
}

export function usesWinrkLatencyStatsOnly(sampleCount = benchLatencySampleCount()): boolean {
  return sampleCount <= 0;
}

/** Cooldown + readiness probe — localhost socket recovery before/after WinRK `-c400`. */
export async function recoverLocalhostSockets(url: string): Promise<void> {
  const cooldownMs = postWinrkCooldownMs();
  if (cooldownMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, cooldownMs));
  }
  releaseBetweenStacks();
  await waitForServerReady(url);
}

export async function prepareForPostWinrkLatencySample(url: string): Promise<void> {
  await recoverLocalhostSockets(url);
}

export async function prepareForWinrkMeasurement(url: string): Promise<void> {
  await recoverLocalhostSockets(url);
}
