import { serveLuxel } from "../node/serve.ts";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = process.env.LUXEL_DIST_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? "3000");

const server = await serveLuxel({
  distDir,
  port,
  hostname: process.env.HOST ?? "127.0.0.1",
  useProductionCompress: process.env.LUXEL_COMPRESS !== "0",
});

console.log(`luxel (node): ${server.url}`);

function shutdown() {
  void server.close().then(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
