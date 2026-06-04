import { serveLuxel } from "../deno/serve.ts";
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

console.log(`luxel (deno): ${server.url}`);

Deno.addSignalListener("SIGINT", () => {
  server.close();
  Deno.exit(0);
});
Deno.addSignalListener("SIGTERM", () => {
  server.close();
  Deno.exit(0);
});

await new Promise(() => {});
