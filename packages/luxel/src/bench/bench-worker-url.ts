import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getLuxelRepoRoot } from "../paths.ts";

/** Absolute worker entry — stable when importers use `@luxel/luxel/bench`. */
export function benchWorkerUrl(filename: string): URL {
  return pathToFileURL(join(getLuxelRepoRoot(), "packages/luxel/src/bench/workers", filename));
}
