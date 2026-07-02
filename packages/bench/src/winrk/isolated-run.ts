import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type StackRow,
  type WinrkBenchResult,
  type WinrkFixtureId,
  stackOptimizations,
  stackRole,
} from "./registry.ts";

const benchRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const bun = process.execPath;

function errorResult(row: StackRow, reason: string): WinrkBenchResult {
  return {
    id: row.id,
    framework: row.framework,
    mode: row.mode,
    role: stackRole(row),
    version: row.version,
    optimizations: stackOptimizations(row),
    status: "error",
    reason,
  };
}

export function runStackIsolated(
  fixture: WinrkFixtureId,
  row: StackRow,
): Promise<WinrkBenchResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bun, ["run", "src/winrk-isolated-stack.ts"], {
      cwd: benchRoot,
      env: {
        ...process.env,
        WINRK_FIXTURE: fixture,
        WINRK_STACK: row.id,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`isolated stack ${row.id} exited with code ${code}`));
        return;
      }
      const line = stdout.trim().split("\n").filter(Boolean).at(-1);
      if (!line) {
        reject(new Error(`isolated stack ${row.id} produced no JSON output`));
        return;
      }
      try {
        const parsed = JSON.parse(line) as WinrkBenchResult & { fixture?: string };
        const { fixture: _fixture, ...result } = parsed;
        resolve(result as WinrkBenchResult);
      } catch (err) {
        reject(
          new Error(
            `isolated stack ${row.id} invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    });
  });
}

export async function runStacksIsolated(
  fixture: WinrkFixtureId,
  rows: StackRow[],
  opts?: { onProgress?: (results: WinrkBenchResult[]) => void | Promise<void> },
): Promise<WinrkBenchResult[]> {
  const results: WinrkBenchResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    console.error(`[${i + 1}/${rows.length}] stack: ${row.id} (isolated subprocess)`);
    try {
      results.push(await runStackIsolated(fixture, row));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`stack ${row.id} failed: ${reason}`);
      results.push(errorResult(row, reason));
    }
    await opts?.onProgress?.(results);
  }
  return results;
}
