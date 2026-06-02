import { readdir } from "node:fs/promises";
import { join } from "node:path";

export type DiscoveredRouteFile = {
  slug: string;
  path: string;
  routeId: string;
  componentId: string;
  filePath: string;
  source: string;
};

export function routeMetaFromSlug(slug: string, filePath: string): DiscoveredRouteFile {
  const path = slug === "index" ? "/" : `/${slug}`;
  return {
    slug,
    path,
    routeId: `route:${slug}`,
    componentId: `sfc:${slug}`,
    filePath,
    source: filePath.replace(/\\/g, "/"),
  };
}

export async function discoverRouteFiles(routesDir: string): Promise<DiscoveredRouteFile[]> {
  const entries = await readdir(routesDir, { withFileTypes: true });
  const routes: DiscoveredRouteFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".luxel")) continue;
    const slug = entry.name.replace(/\.luxel$/, "");
    routes.push(routeMetaFromSlug(slug, join(routesDir, entry.name)));
  }
  return routes.sort((a, b) => a.slug.localeCompare(b.slug));
}
