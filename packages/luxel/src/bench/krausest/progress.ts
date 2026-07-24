import { writeFileSync } from "node:fs";

const EXECUTING_RE =
  /Executing frameworks\/([^\s]+)\s+and benchmark\s+([\d]+_[\w-]+)/i;
const BENCHMARK_RE = /benchmark\s+([\d]+_[\w-]+)/i;

export type KrausestDriverProgressEvent = {
  frameworkPath: string;
  benchId: string;
};

export type KrausestProgressState = {
  frameworkIndex: number;
  frameworkTotal: number;
  benchIndex: number;
  benchTotal: number;
  frameworkLabel: string;
  benchId: string;
  elapsedMs: number;
  etaMs?: number;
};

export function parseKrausestDriverProgressLine(line: string): KrausestDriverProgressEvent | null {
  const trimmed = line.trim();
  const match = trimmed.match(EXECUTING_RE);
  if (!match?.[1] || !match[2]) return null;
  return { frameworkPath: match[1], benchId: match[2] };
}

export function formatKrausestProgress(state: KrausestProgressState): string {
  const elapsed = formatDuration(state.elapsedMs);
  const eta =
    state.etaMs !== undefined && Number.isFinite(state.etaMs) && state.etaMs > 0
      ? ` — ETA ~${formatDuration(state.etaMs)}`
      : "";
  return `[fw ${state.frameworkIndex}/${state.frameworkTotal}] [bench ${state.benchIndex}/${state.benchTotal}] ${state.frameworkLabel} — ${state.benchId} — elapsed ${elapsed}${eta}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export type KrausestProgressFramework = {
  driverPath: string;
  label: string;
  /** Upstream `customURL` (e.g. `/bundled-dist`) — Executing logs append this to the path. */
  customURL?: string;
};

/** Path as printed in upstream `Executing frameworks/...` lines. */
export function krausestProgressFrameworkPath(
  driverPath: string,
  customURL?: string,
): string {
  if (!customURL) return driverPath;
  const suffix = customURL.startsWith("/") ? customURL.slice(1) : customURL;
  return suffix ? `${driverPath}/${suffix}` : driverPath;
}

export class KrausestProgressTracker {
  private readonly startedAt = Date.now();
  private completedCells = 0;
  private frameworkPathToLabel = new Map<string, string>();
  private frameworkPathToIndex = new Map<string, number>();
  private current: KrausestDriverProgressEvent | null = null;

  constructor(
    private readonly frameworkTotal: number,
    private readonly benchTotal: number,
    frameworkPaths: readonly KrausestProgressFramework[],
  ) {
    for (const [index, framework] of frameworkPaths.entries()) {
      const paths = new Set([
        framework.driverPath,
        krausestProgressFrameworkPath(framework.driverPath, framework.customURL),
      ]);
      for (const path of paths) {
        this.frameworkPathToLabel.set(path, framework.label);
        this.frameworkPathToIndex.set(path, index + 1);
      }
    }
  }

  onDriverLine(line: string): KrausestProgressState | null {
    const event = parseKrausestDriverProgressLine(line);
    if (!event) return null;
    if (this.current) this.completedCells += 1;
    this.current = event;
    return this.stateFor(event);
  }

  finalize(): void {
    if (this.current) this.completedCells += 1;
    this.current = null;
  }

  private stateFor(event: KrausestDriverProgressEvent): KrausestProgressState {
    const totalCells = Math.max(1, this.frameworkTotal * this.benchTotal);
    const elapsedMs = Date.now() - this.startedAt;
    const completed = Math.min(this.completedCells, totalCells - 1);
    const etaMs =
      completed > 0 ? Math.round((elapsedMs / completed) * (totalCells - completed)) : undefined;
    return {
      frameworkIndex: this.frameworkPathToIndex.get(event.frameworkPath) ?? 0,
      frameworkTotal: this.frameworkTotal,
      benchIndex: this.benchIndexFor(event.benchId),
      benchTotal: this.benchTotal,
      frameworkLabel: this.frameworkPathToLabel.get(event.frameworkPath) ?? event.frameworkPath,
      benchId: event.benchId,
      elapsedMs,
      etaMs,
    };
  }

  private benchIndexFor(benchId: string): number {
    const order = benchId.match(BENCHMARK_RE)?.[1] ?? benchId;
    const numeric = Number(order.split("_")[0]);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  }
}

function writeProgressLine(line: string, finalize: boolean): void {
  if (process.stderr.isTTY) {
    process.stderr.write(finalize ? `\r${line}\n` : `\r${line}`);
    return;
  }
  if (finalize) console.error(line);
}

export function logKrausestProgress(state: KrausestProgressState, finalize = false): void {
  writeProgressLine(formatKrausestProgress(state), finalize);
}

export type KrausestHarnessTimings = {
  zipMs: number;
  rebuildMs: number;
  driverMs: number;
};

export function formatKrausestHarnessTimings(timings: KrausestHarnessTimings): string {
  return `krausest harness: setup.zip_ms=${timings.zipMs} setup.rebuild_ms=${timings.rebuildMs} driver.total_ms=${timings.driverMs}`;
}

/** Provisional phase budgets (diagnose #100; override via KRAUSEST_PHASE_TIMEOUT_<PHASE>_MS). */
export const KRAUSEST_PHASE_TIMEOUT_MS = {
  "driver-build": 30 * 60_000,
  zip: 30 * 60_000,
  rebuild: 60 * 60_000,
  "server-ready": 2 * 60_000,
  "chrome-resolve": 2 * 60_000,
  // count≥20 / dual-framework full matrix can exceed 45m on Windows chrome150.
  "driver-batch": 90 * 60_000,
} as const;

export type KrausestPhaseName = keyof typeof KRAUSEST_PHASE_TIMEOUT_MS;

export function krausestPhaseTimeoutMs(phase: KrausestPhaseName): number {
  const envKey = `KRAUSEST_PHASE_TIMEOUT_${phase.toUpperCase().replace(/-/g, "_")}_MS`;
  const raw = process.env[envKey]?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return KRAUSEST_PHASE_TIMEOUT_MS[phase];
}

export function krausestPhaseHeartbeatMs(): number {
  const raw = process.env.KRAUSEST_PHASE_HEARTBEAT_MS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 15_000;
}

function formatPhaseElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function emitKrausestPhaseLine(line: string): void {
  console.error(line);
  const hbFile = process.env.KRAUSEST_HEARTBEAT_FILE;
  if (!hbFile) return;
  try {
    writeFileSync(hbFile, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // best-effort stall probe (PowerShell stderr redirect can buffer)
  }
}

/**
 * Run a setup/driver phase with stderr heartbeat + hard timeout.
 * Quiet multi-minute work must not look dead.
 */
export async function withKrausestPhaseTimeout<T>(
  phase: KrausestPhaseName,
  fn: () => Promise<T>,
  opts?: { timeoutMs?: number; heartbeatMs?: number },
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? krausestPhaseTimeoutMs(phase);
  const heartbeatMs = opts?.heartbeatMs ?? krausestPhaseHeartbeatMs();
  const started = Date.now();
  emitKrausestPhaseLine(
    `krausest phase ${phase}: start (timeout ${formatPhaseElapsed(timeoutMs)})`,
  );

  const heartbeat = setInterval(() => {
    const elapsed = Date.now() - started;
    emitKrausestPhaseLine(
      `krausest phase ${phase}: still running — elapsed ${formatPhaseElapsed(elapsed)} / budget ${formatPhaseElapsed(timeoutMs)}`,
    );
  }, heartbeatMs);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `krausest phase ${phase} timed out after ${formatPhaseElapsed(timeoutMs)}`,
        ),
      );
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeout]);
    emitKrausestPhaseLine(
      `krausest phase ${phase}: done (${formatPhaseElapsed(Date.now() - started)})`,
    );
    return result;
  } finally {
    clearInterval(heartbeat);
    if (timer !== undefined) clearTimeout(timer);
  }
}
