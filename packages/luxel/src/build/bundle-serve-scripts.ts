import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BundleBackend } from "../host/backends/types.ts";
import { bundleEsm } from "./bundle-esm.ts";
import { pickBundleBackend } from "./pick-bundle-backend.ts";
import { getLuxelPkgSrc } from "../paths.ts";

export async function bundleServeScripts(
  outDir: string,
  backend: BundleBackend = pickBundleBackend(),
): Promise<void> {
  const pkgSrc = getLuxelPkgSrc();
  const nodeEntry = join(pkgSrc, "build", "serve-node-entry.ts");
  const denoEntry = join(pkgSrc, "build", "serve-deno-entry.ts");
  const serverDir = join(outDir, "server");

  const [nodeOutput] = await bundleEsm(backend, [nodeEntry], {
    root: pkgSrc,
    platform: "node",
    write: false,
  });
  await writeFile(join(serverDir, "start-node.mjs"), nodeOutput.text, "utf8");

  const [denoOutput] = await bundleEsm(backend, [denoEntry], {
    root: pkgSrc,
    platform: "node",
    write: false,
  });
  await writeFile(join(serverDir, "start-deno.mjs"), denoOutput.text, "utf8");
}
