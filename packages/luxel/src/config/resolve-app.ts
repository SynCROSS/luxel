import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const DEFAULT_APP_DIR = "examples/counter";

/** Resolve app dir (e.g. examples/nav-demo) from cwd; walks up for luxel.config.ts. */
export function resolveAppDir(cwd: string, repoRoot: string): string {
  let dir = cwd;
  for (let i = 0; i < 12; i++) {
    const configPath = join(dir, "luxel.config.ts");
    if (existsSync(configPath)) {
      const rel = relative(repoRoot, dir).replace(/\\/g, "/");
      if (rel && !rel.startsWith("..")) return rel;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return DEFAULT_APP_DIR;
}
