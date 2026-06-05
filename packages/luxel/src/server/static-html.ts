import { readFile } from "node:fs/promises";
import { join } from "node:path";

export function staticHtmlPath(staticRoot: string, pathname: string): string {
  const path = pathname === "" || pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  if (path === "/") return join(staticRoot, "index.html");
  return join(staticRoot, path.slice(1), "index.html");
}

export async function tryReadStaticHtml(
  staticRoot: string,
  pathname: string,
): Promise<string | null> {
  try {
    return await readFile(staticHtmlPath(staticRoot, pathname), "utf8");
  } catch {
    return null;
  }
}

export async function writeStaticHtml(
  staticRoot: string,
  routePath: string,
  html: string,
): Promise<string> {
  const filePath = staticHtmlPath(staticRoot, routePath);
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, html, "utf8");
  return filePath;
}
