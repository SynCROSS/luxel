import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

/** Rewrite `./tiles.ts` sibling imports for compiled output under `.bench/`. */
export function absolutizeBenchTilesImport(sourcePath: string, code: string): string {
  const tilesUrl = pathToFileURL(join(dirname(sourcePath), "tiles.ts")).href;
  return code.replace(/from\s+["']\.\/tiles\.ts["']/g, `from "${tilesUrl}"`);
}
