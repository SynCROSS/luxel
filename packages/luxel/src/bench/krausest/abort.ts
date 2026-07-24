import type { ChildProcess } from "node:child_process";
import { killProcessTree } from "../../util/kill-process-tree.ts";

const trackedPids = new Set<number>();
let signalHooksInstalled = false;
let cleaning = false;

export function trackKrausestChild(child: ChildProcess): void {
  const pid = child.pid;
  if (pid != null && pid > 0) trackedPids.add(pid);
  const forget = () => {
    if (pid != null) trackedPids.delete(pid);
  };
  child.once("exit", forget);
  child.once("error", forget);
}

export function killTrackedKrausestChildren(): void {
  for (const pid of [...trackedPids]) {
    killProcessTree(pid);
    trackedPids.delete(pid);
  }
}

export function installKrausestAbortHooks(): void {
  if (signalHooksInstalled) return;
  signalHooksInstalled = true;
  const onAbort = () => {
    if (cleaning) return;
    cleaning = true;
    console.error("krausest: abort — killing server/driver/chrome process tree");
    killTrackedKrausestChildren();
    process.exit(130);
  };
  process.on("SIGINT", onAbort);
  process.on("SIGTERM", onAbort);
}
