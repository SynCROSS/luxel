import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  compress: false,
  generateEtags: false,
  productionBrowserSourceMaps: false,
  outputFileTracingRoot: join(appDir, "../../../.."),
  experimental: {
    optimizePackageImports: ["react", "react-dom"],
  },
};
export default nextConfig;
