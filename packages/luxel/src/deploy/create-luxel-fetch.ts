import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadAppFromDist } from "./load-app.ts";
import { createAppServerFetch } from "../server/handler.ts";
import type { CompressOptions } from "../server/compress.ts";
import { resolveProductionCompressOptions } from "../config/compress.ts";

export type CreateLuxelFetchOptions = {
  distDir: string;
  compress?: CompressOptions;
  useProductionCompress?: boolean;
};

export async function createLuxelFetchFromDist(options: CreateLuxelFetchOptions) {
  const { app, clientBundle } = await loadAppFromDist(options.distDir);
  const compress =
    options.compress ??
    (options.useProductionCompress !== false
      ? resolveProductionCompressOptions()
      : { enabled: false });

  const staticRoot = join(options.distDir, "static");
  return createAppServerFetch({
    app,
    clientBundle,
    compress,
    staticRoot: existsSync(staticRoot) ? staticRoot : undefined,
  });
}
