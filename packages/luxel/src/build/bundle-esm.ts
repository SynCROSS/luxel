import type { BundleBackend, BundleOptions, BundleOutput } from "../host/backends/types.ts";

export async function bundleEsm(
  backend: BundleBackend,
  entrypoints: string[],
  options: BundleOptions,
): Promise<BundleOutput[]> {
  const { outputs } = await backend.bundle(entrypoints, options);
  if (outputs.length === 0) {
    throw new Error(`${backend.id} bundle produced no outputs`);
  }
  return outputs;
}
