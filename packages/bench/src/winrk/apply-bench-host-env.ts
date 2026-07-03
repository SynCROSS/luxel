import { applyDefaultBenchRenderWorkerBackendEnv } from "@luxel/luxel/bench";

/** Pin platform worker backend + production env before WinRK stack servers start. */
applyDefaultBenchRenderWorkerBackendEnv();
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_ENV = "production";
}
