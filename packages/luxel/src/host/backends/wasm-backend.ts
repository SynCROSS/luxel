import type { BundleBackend } from "./types.ts";

/** Post-v1.1-rc performance path — same CLI surface as esbuild backend. */
export const wasmBackend: BundleBackend = {
  id: "wasm",
  async bundle() {
    throw new Error("wasm bundle backend not wired yet");
  },
};
