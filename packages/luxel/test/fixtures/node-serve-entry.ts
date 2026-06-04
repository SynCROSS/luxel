import { serveLuxel } from "../../src/node/serve.ts";

const distDir = process.env.LUXEL_DIST_DIR;
if (!distDir) {
  console.error("LUXEL_DIST_DIR required");
  process.exit(1);
}

const compressEnabled = process.env.LUXEL_COMPRESS === "1";
const server = await serveLuxel({
  distDir,
  hostname: "127.0.0.1",
  compress: compressEnabled
    ? { enabled: true, threshold: 0, encodings: ["gzip"] }
    : { enabled: false },
  useProductionCompress: false,
});

console.log(JSON.stringify({ url: server.url }));

process.on("SIGTERM", () => {
  void server.close().then(() => process.exit(0));
});
