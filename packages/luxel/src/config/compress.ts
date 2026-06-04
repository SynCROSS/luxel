import type { CompressOptions, CompressionFormat } from "../server/compress.ts";

export type LuxelServerConfig = {
  compress?: CompressOptions;
};

const DEFAULT_ENCODINGS: CompressionFormat[] = ["zstd", "br", "gzip", "deflate"];

export const DEFAULT_COMPRESS_OPTIONS: Required<Pick<CompressOptions, "enabled" | "threshold">> & {
  encodings: CompressionFormat[];
} = {
  enabled: false,
  threshold: 1024,
  encodings: DEFAULT_ENCODINGS,
};

export function resolveCompressOptions(
  fromConfig?: CompressOptions,
  overrides?: CompressOptions,
): CompressOptions {
  return {
    enabled: overrides?.enabled ?? fromConfig?.enabled ?? DEFAULT_COMPRESS_OPTIONS.enabled,
    threshold: overrides?.threshold ?? fromConfig?.threshold ?? DEFAULT_COMPRESS_OPTIONS.threshold,
    encodings: overrides?.encodings ?? fromConfig?.encodings ?? DEFAULT_COMPRESS_OPTIONS.encodings,
  };
}

/** Production deploy defaults: compression on unless config disables. */
export function resolveProductionCompressOptions(fromConfig?: CompressOptions): CompressOptions {
  return resolveCompressOptions({ ...fromConfig, enabled: fromConfig?.enabled ?? true });
}
