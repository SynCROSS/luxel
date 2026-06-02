import { compileCounterApp } from "../route/compile-app.ts";
import type { Manifest } from "../manifest/types.ts";

export async function discoverManifest(_routesDir: string, repoRoot: string): Promise<Manifest> {
  const app = await compileCounterApp(repoRoot);
  return app.manifest;
}
