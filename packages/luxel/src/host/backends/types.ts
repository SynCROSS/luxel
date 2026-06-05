export type BundlePlatform = "browser" | "node" | "bun";

export type BundleOptions = {
  root: string;
  outdir?: string;
  outfile?: string;
  platform?: BundlePlatform;
  minify?: boolean;
  /** false = return outputFiles in memory (default when no outfile/outdir). */
  write?: boolean;
};

export type BundleOutput = {
  path: string;
  text: string;
};

/** Pluggable bundle backend for v1.1 native host (no Bun on PATH). */
export type BundleBackend = {
  readonly id: "esbuild" | "wasm" | "bun";
  bundle(entrypoints: string[], options: BundleOptions): Promise<{ outputs: BundleOutput[] }>;
};
