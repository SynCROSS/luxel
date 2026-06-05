import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { BundleBackend } from "../host/backends/types.ts";
import { bundleEsm } from "./bundle-esm.ts";
import { pickBundleBackend } from "./pick-bundle-backend.ts";

export async function bundleClient(
  genRoot: string,
  backend: BundleBackend = pickBundleBackend(),
): Promise<{ js: string }> {
  await mkdir(genRoot, { recursive: true });
  const entry = join(genRoot, "client-entry.ts");
  const [output] = await bundleEsm(backend, [entry], {
    root: genRoot,
    platform: "browser",
    write: false,
  });
  return { js: output.text };
}
