import { threadId } from "node:worker_threads";

/**
 * Bench processes must run frameworks in production mode.
 * Import this module before any framework dependency loads.
 */
export function ensureBenchProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") {
    process.env.NODE_ENV = "production";
  }
  if (process.env.NEXT_TELEMETRY_DISABLED !== "1") {
    process.env.NEXT_TELEMETRY_DISABLED = "1";
  }
}

// Parent NODE_ENV=production breaks Bun Worker react-dom — apply in worker threads only.
// React render workers skip this import; NODE_ENV=production in worker breaks cache-busted react-dom loads.
if (threadId !== 0) {
  ensureBenchProductionEnv();
}
