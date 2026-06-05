import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { HtmlCacheAdapter, HtmlCacheEntry } from "./html-cache.ts";

function cacheFilePath(root: string, routePath: string): string {
  const slug = routePath === "/" ? "index" : routePath.replace(/^\//, "").replace(/\//g, "_");
  return join(root, `${slug}.json`);
}

export class FsHtmlCacheAdapter implements HtmlCacheAdapter {
  constructor(private readonly root: string) {}

  async get(path: string): Promise<HtmlCacheEntry | null> {
    try {
      const raw = await readFile(cacheFilePath(this.root, path), "utf8");
      return JSON.parse(raw) as HtmlCacheEntry;
    } catch {
      return null;
    }
  }

  async set(path: string, entry: HtmlCacheEntry): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(cacheFilePath(this.root, path), JSON.stringify(entry), "utf8");
  }

  async invalidateByTag(tag: string): Promise<void> {
    let files: string[];
    try {
      files = await readdir(this.root);
    } catch {
      return;
    }
    await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (file) => {
          const filePath = join(this.root, file);
          const entry = JSON.parse(await readFile(filePath, "utf8")) as HtmlCacheEntry;
          if (entry.tags.includes(tag)) {
            await unlink(filePath);
          }
        }),
    );
  }
}
