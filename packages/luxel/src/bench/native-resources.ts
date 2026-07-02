import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getLuxelRepoRoot } from "../paths.ts";
import { getLuxelCoreNodeModule, isLuxelCoreNodeLoadable } from "./ensure-core-node.ts";

export type NativeResourceBenchLine = {
  fixture: "native-resource";
  metric: "rss_mb" | "cold_start_ms" | "install_size_mb";
  value: number;
};

function measureInstallSizeMb(): number {
  const repoRoot = getLuxelRepoRoot();
  const candidates = [
    join(repoRoot, "packages/core-node"),
    join(repoRoot, "node_modules/@luxel/core-node"),
  ];
  let bytes = 0;
  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    const stack = [dir];
    while (stack.length > 0) {
      const path = stack.pop()!;
      const stat = statSync(path);
      if (stat.isDirectory()) {
        for (const entry of readdirSync(path)) {
          stack.push(join(path, entry));
        }
        continue;
      }
      bytes += stat.size;
    }
    break;
  }
  return bytes / (1024 * 1024);
}

export function* runNativeResourceBench(): Generator<NativeResourceBenchLine> {
  if (isLuxelCoreNodeLoadable()) {
    const start = performance.now();
    getLuxelCoreNodeModule();
    yield { fixture: "native-resource", metric: "cold_start_ms", value: performance.now() - start };
    yield {
      fixture: "native-resource",
      metric: "rss_mb",
      value: process.memoryUsage().rss / (1024 * 1024),
    };
  }

  const installMb = measureInstallSizeMb();
  if (installMb > 0) {
    yield { fixture: "native-resource", metric: "install_size_mb", value: installMb };
  }
}
