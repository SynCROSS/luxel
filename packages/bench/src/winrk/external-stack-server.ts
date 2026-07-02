import { execSync, spawn, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const benchRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const bun = process.execPath;
const READY_RE = /BENCH_READY (http:\/\/\S+)/;
const CHILD_CLOSE_TIMEOUT_MS = 8_000;

const LUXEL_WORKER_POOL_STACKS = new Set([
  "luxel-ssr-worker-pool",
  "luxel-ssr-full-worker-pool",
  "luxel-isr-worker-pool",
  "luxel-spiral-ssr-worker-pool",
]);

export function usesExternalStackServer(stackId: string): boolean {
  if (!LUXEL_WORKER_POOL_STACKS.has(stackId)) return false;
  const raw = process.env.BENCH_LUXEL_EXTERNAL_SERVER?.trim().toLowerCase();
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  // Opt-in only — harness-wide node workers run in-process like other *-worker-pool rows.
  return false;
}

type ExternalServerHandle = {
  url: string;
  close: () => Promise<void>;
};

function forceKillChildTree(pid: number | undefined): void {
  if (!pid || pid <= 0) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } catch {
      /* already dead */
    }
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    /* already dead */
  }
}

export async function startExternalStackServer(stackId: string): Promise<ExternalServerHandle> {
  const child: ChildProcess = spawn(bun, ["run", "src/winrk/stack-child-server.ts", stackId], {
    cwd: benchRoot,
    env: {
      ...process.env,
      BENCH_LUXEL_EXTERNAL_CHILD: "1",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const url = await new Promise<string>((resolve, reject) => {
    let buf = "";
    const onData = (chunk: Buffer | string) => {
      buf += chunk.toString();
      const match = buf.match(READY_RE);
      if (match) {
        child.stderr?.off("data", onData);
        resolve(match[1]!);
      }
    };
    child.stdout?.on("data", (chunk) => process.stderr.write(chunk));
    child.stderr?.on("data", onData);
    child.on("error", reject);
    child.on("close", (code) => {
      if (!READY_RE.test(buf)) {
        reject(new Error(`external stack ${stackId} exited ${code} before ready`));
      }
    });
  });

  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    url,
    close: () =>
      new Promise((resolve) => {
        if (child.killed || child.exitCode !== null) {
          resolve();
          return;
        }

        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        const forceTimer = setTimeout(() => {
          forceKillChildTree(child.pid);
          finish();
        }, CHILD_CLOSE_TIMEOUT_MS);

        child.once("close", () => {
          clearTimeout(forceTimer);
          finish();
        });
        child.once("error", () => {
          clearTimeout(forceTimer);
          finish();
        });

        try {
          child.stdin?.end();
        } catch {
          /* ignore */
        }
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null) {
            child.kill("SIGKILL");
            forceKillChildTree(child.pid);
          }
        }, 2_000).unref();
      }),
  };
}
