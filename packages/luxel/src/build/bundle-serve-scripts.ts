import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { findDenoExecutable } from "../util/find-deno.ts";

const pkgSrc = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function bundleServeScripts(outDir: string): Promise<void> {
  const nodeEntry = join(pkgSrc, "build", "serve-node-entry.ts");
  const denoEntry = join(pkgSrc, "build", "serve-deno-entry.ts");
  const serverDir = join(outDir, "server");

  const nodeResult = await Bun.build({
    entrypoints: [nodeEntry],
    target: "node",
    format: "esm",
  });
  if (!nodeResult.success) {
    throw new Error(nodeResult.logs.map((l) => l.message).join("\n"));
  }

  await writeFile(join(serverDir, "start-node.mjs"), await nodeResult.outputs[0]!.text(), "utf8");

  const deno = findDenoExecutable();
  const denoOut = join(serverDir, "start-deno.mjs");
  if (!deno) {
    await writeFile(
      denoOut,
      `console.error("start-deno.mjs was not bundled: install Deno and re-run luxel build");\nDeno.exit(1);\n`,
      "utf8",
    );
    return;
  }

  const bundled = spawnSync(
    deno,
    ["bundle", denoEntry, "-o", denoOut],
    { encoding: "utf8" },
  );
  if (bundled.status !== 0) {
    throw new Error(`deno bundle failed: ${bundled.stderr || bundled.stdout}`);
  }
}
