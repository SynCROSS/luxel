import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSpiralLuxelSfc } from "./fixtures/spiral-sfc.ts";

const SPIRAL_APP = "examples/spiral";

/** Writes generated spiral SFC before compile (large static template — not hand-edited). */
export async function ensureSpiralFixture(repoRoot: string): Promise<string> {
  const appDir = join(repoRoot, SPIRAL_APP);
  const routesDir = join(appDir, "src/routes");
  await mkdir(routesDir, { recursive: true });
  const routePath = join(routesDir, "index.luxel");
  await writeFile(routePath, buildSpiralLuxelSfc(), "utf8");
  return SPIRAL_APP;
}
