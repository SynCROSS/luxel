import { cleanupOrphanBenchProcesses } from "./bench-cleanup-orphans.ts";

const killed = cleanupOrphanBenchProcesses();
console.error(killed > 0 ? `cleaned ${killed} orphan bench process(es)` : "no orphan bench processes found");
