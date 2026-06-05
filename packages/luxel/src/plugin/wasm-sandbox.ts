import { ADD_PLUGIN_WASM } from "./manifest.ts";

export type WasmAddHook = {
  run(a: number, b: number): number;
};

/** Host imports granted when manifest capabilities allow. */
export function createSandboxImports(capabilities: readonly string[]): WebAssembly.Imports {
  if (!capabilities.includes("network")) {
    return {};
  }
  return {
    env: {
      fetch: () => 42,
    },
  };
}

export type WasmFetchHook = {
  run(): number;
};

export async function loadWasmFetchPlugin(
  wasmBytes: Uint8Array,
  capabilities: readonly string[] = ["transform-script"],
): Promise<WasmFetchHook> {
  const { instance } = await WebAssembly.instantiate(wasmBytes, createSandboxImports(capabilities));
  const run = instance.exports.run;
  if (typeof run !== "function") {
    throw new Error("plugin missing run export");
  }
  return {
    run() {
      return (run as () => number)();
    },
  };
}

export async function loadWasmAddPlugin(
  wasmBytes: Uint8Array = ADD_PLUGIN_WASM,
  capabilities: readonly string[] = ["transform-script"],
): Promise<WasmAddHook> {
  const { instance } = await WebAssembly.instantiate(wasmBytes, createSandboxImports(capabilities));
  const run = instance.exports.run;
  if (typeof run !== "function") {
    throw new Error("plugin missing run export");
  }
  return {
    run(a: number, b: number) {
      return (run as (x: number, y: number) => number)(a, b);
    },
  };
}
