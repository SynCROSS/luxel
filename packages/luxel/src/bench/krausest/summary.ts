import type { KrausestRunRow } from "./run.ts";

const MOUSE_WARNING =
  /PLEASE MAKE SURE THAT YOUR MOUSE IS OUTSIDE OF THE BROWSER WINDOW[^\n]*/gi;

/** Collapse upstream webdriver-ts log spam into one line. */
export function summarizeKrausestDriverFailure(message: string): string {
  const withoutMouse = message.replace(MOUSE_WARNING, "").trim();
  const withoutPrefix = withoutMouse.replace(/^krausest\s+/i, "");
  const lines = withoutPrefix
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const exitMatch = withoutPrefix.match(/benchmarkRunner exit (\d+)/i);
  const failed = new Set<string>();
  const failedFrameworks = new Set<string>();
  const errors: string[] = [];

  for (const line of lines) {
    const withFw = line.match(
      /Executing frameworks\/([^\s]+) and benchmark\s+([\d]+_[\w-]+)\s+failed/i,
    );
    if (withFw?.[1] && withFw[2]) {
      failedFrameworks.add(withFw[1]);
      failed.add(withFw[2]);
    } else {
      const benchOnly = line.match(/benchmark\s+([\d]+_[\w-]+)\s+failed/i);
      if (benchOnly?.[1]) failed.add(benchOnly[1]);
    }

    const failedTail = line.match(/failed:\s*(.+)$/i);
    if (failedTail?.[1] && !failedTail[1].includes(" at ")) {
      const cleaned = failedTail[1].slice(0, 240);
      if (!cleaned.startsWith("Cannot compute stats") && !errors.includes(cleaned)) {
        errors.push(cleaned);
      }
    }

    if (
      /^(SecurityError|Error:|ERROR DOMException|ERROR in run Benchmark)/i.test(line) &&
      !line.includes(" at ")
    ) {
      const cleaned = line
        .replace(/^ERROR DOMException:\s*/i, "")
        .replace(/^ERROR in run Benchmark:\s*\|\s*/i, "")
        .replace(/^Error:\s*/i, "")
        .slice(0, 240);
      if (cleaned && !cleaned.startsWith("Cannot compute stats") && !errors.includes(cleaned)) {
        errors.push(cleaned);
      }
    }
  }

  const parts: string[] = [];
  if (exitMatch?.[1]) parts.push(`driver exit ${exitMatch[1]}`);
  if (failedFrameworks.size > 0) {
    parts.push(`frameworks: ${[...failedFrameworks].slice(0, 5).join(", ")}`);
  }
  if (failed.size > 0) parts.push(`failed benchmarks: ${[...failed].join(", ")}`);
  if (errors.length > 0) parts.push(errors.slice(0, 2).join("; "));

  if (parts.length > 0) return `krausest ${parts.join(" | ")}`;
  const compact = withoutPrefix
    .replace(/DeprecationWarning[^\n]*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
  return compact.length > 0 ? `krausest ${compact}` : "krausest driver failed";
}

export function formatKrausestRowsSummary(rows: KrausestRunRow[]): string {
  if (rows.length === 0) return "krausest: no rows";
  const parts = rows.map((row) => {
    if (row.memoryMb !== undefined && row.durationMs === 0) {
      return `${row.scenario}=${row.memoryMb.toFixed(2)}mb`;
    }
    if (row.transferKb !== undefined && row.durationMs === 0) {
      return `${row.scenario}=${row.transferKb.toFixed(1)}kb`;
    }
    return `${row.scenario}=${row.durationMs.toFixed(1)}ms`;
  });
  return `krausest ok (${rows.length}): ${parts.join(", ")}`;
}
