import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let luxelPkgSrcOverride: string | undefined;

/** Set before native-host build when sources are bundled (import.meta.url is wrong). */
export function setLuxelPkgSrc(root: string): void {
  luxelPkgSrcOverride = root;
}

/** Absolute path to `packages/luxel/src`. */
export function getLuxelPkgSrc(): string {
  const fromEnv = process.env.LUXEL_PKG_SRC?.trim();
  if (fromEnv) return fromEnv;
  if (luxelPkgSrcOverride) return luxelPkgSrcOverride;
  return join(dirname(fileURLToPath(import.meta.url)), ".");
}

/** Monorepo root (`packages/luxel/src` → three levels up). */
export function getLuxelRepoRoot(): string {
  const fromEnv = process.env.LUXEL_REPO_ROOT?.trim();
  if (fromEnv) return fromEnv;
  return join(getLuxelPkgSrc(), "../../..");
}
