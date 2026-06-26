import { ensureCoreNodeBuilt as ensureCoreNodeBuiltImpl } from "../../src/bench/ensure-core-node.ts";

let buildPromise: Promise<void> | null = null;

export function ensureCoreNodeBuilt(): Promise<void> {
  if (!buildPromise) {
    buildPromise = ensureCoreNodeBuiltImpl();
  }
  return buildPromise;
}
