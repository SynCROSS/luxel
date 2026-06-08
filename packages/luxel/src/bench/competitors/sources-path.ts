import { join } from "node:path";
import { getLuxelPkgSrc } from "../../paths.ts";

/** Absolute path to a bench competitor source file under `competitors/sources/`. */
export function competitorSource(...segments: string[]): string {
  return join(getLuxelPkgSrc(), "bench", "competitors", "sources", ...segments);
}
