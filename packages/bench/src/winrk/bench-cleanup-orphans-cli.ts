import {
  cleanupOrphanBenchProcesses,
  isAggressiveCleanupRequested,
} from "./bench-cleanup-orphans.ts";

const aggressive = isAggressiveCleanupRequested();
const killed = cleanupOrphanBenchProcesses({ aggressive });
const mode = aggressive ? " (aggressive)" : "";
console.error(
  killed > 0
    ? `cleaned ${killed} orphan bench process(es)${mode}`
    : `no orphan bench processes found${mode}`,
);
