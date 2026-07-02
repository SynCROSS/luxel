import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { Readable } from "node:stream";
import { join } from "node:path";
import { getLuxelPkgSrc, getLuxelRepoRoot } from "../paths.ts";
import { findNodeExecutable } from "../util/find-node.ts";
import { ensureRenderdNodeBundle } from "./ensure-renderd-bundle.ts";

export type RenderdChildRuntime = "auto" | "bun" | "node";

export type RenderdChildProcess = {
  writeStdin: (chunk: Uint8Array) => void;
  endStdin: () => void;
  stdout: ReadableStream<Uint8Array>;
  waitExit: () => Promise<number>;
  kill: () => void;
};

export function canSpawnRenderdChild(): boolean {
  if (typeof Bun !== "undefined" && typeof Bun.spawn === "function") return true;
  return findNodeExecutable() !== null;
}

export function resolveRenderdChildRuntime(preferred: RenderdChildRuntime = "auto"): "bun" | "node" {
  if (preferred === "bun") return "bun";
  if (preferred === "node") return "node";
  if (typeof Bun !== "undefined" && typeof Bun.spawn === "function") return "bun";
  return "node";
}

function wrapNodeChild(child: ChildProcessWithoutNullStreams): RenderdChildProcess {
  if (!child.stdin || !child.stdout) {
    throw new Error("renderd node child missing stdio pipes");
  }
  const stdout = Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>;
  return {
    writeStdin(chunk) {
      child.stdin!.write(chunk);
    },
    endStdin() {
      child.stdin!.end();
    },
    stdout,
    waitExit() {
      return new Promise((resolve) => {
        child.on("close", (code) => resolve(code ?? 1));
      });
    },
    kill() {
      child.kill();
    },
  };
}

function renderdChildEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_NO_WARNINGS: "1",
    LUXEL_PKG_SRC: getLuxelPkgSrc(),
    LUXEL_REPO_ROOT: getLuxelRepoRoot(),
  };
}

function spawnRenderdWithNode(): RenderdChildProcess {
  const nodeBin = findNodeExecutable();
  if (!nodeBin) {
    throw new Error("renderd node child requires node executable on PATH");
  }
  const entry = ensureRenderdNodeBundle();
  const child = nodeSpawn(nodeBin, [entry], {
    stdio: ["pipe", "pipe", "inherit"],
    windowsHide: true,
    cwd: getLuxelRepoRoot(),
    env: renderdChildEnv(),
  });
  return wrapNodeChild(child);
}

function spawnRenderdWithBun(): RenderdChildProcess {
  if (typeof Bun === "undefined" || typeof Bun.spawn !== "function") {
    throw new Error("renderd bun child requires Bun.spawn");
  }
  const entry = join(getLuxelPkgSrc(), "renderd/renderd-entry.ts");
  const proc = Bun.spawn(["bun", entry], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
    cwd: getLuxelRepoRoot(),
    env: renderdChildEnv(),
  });
  if (!proc.stdin || !proc.stdout) {
    throw new Error("renderd bun child missing stdio pipes");
  }
  return {
    writeStdin(chunk) {
      proc.stdin!.write(chunk);
    },
    endStdin() {
      proc.stdin!.end();
    },
    stdout: proc.stdout,
    async waitExit() {
      return proc.exited;
    },
    kill() {
      proc.kill();
    },
  };
}

export function spawnRenderdChild(options?: { childRuntime?: RenderdChildRuntime }): RenderdChildProcess {
  const runtime = resolveRenderdChildRuntime(options?.childRuntime ?? "auto");
  if (runtime === "bun") return spawnRenderdWithBun();
  return spawnRenderdWithNode();
}
