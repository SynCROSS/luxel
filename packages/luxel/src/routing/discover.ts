import { access } from "node:fs/promises";
import { join } from "node:path";
import { generateCounterManifest } from "../manifest/generate.ts";

export async function discoverManifest(routesDir: string) {
  await access(join(routesDir, "index.luxel"));
  return generateCounterManifest();
}
