import { compileCounterApp, type CompiledApp } from "./compile-app.ts";

export async function compileCounterRoute(repoRoot: string): Promise<CompiledApp> {
  return compileCounterApp(repoRoot);
}
