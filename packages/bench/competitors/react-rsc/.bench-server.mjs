import { createServer } from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node:url";
import next from "next";

const dir = dirname(fileURLToPath(import.meta.url));
const app = next({ dev: false, dir });
await app.prepare();
const nextHandler = app.getRequestHandler();
const rootParsed = parse("/", true);

function benchParsedUrl(raw) {
  if (!raw || raw === "/" || raw.startsWith("/?")) return rootParsed;
  return parse(raw, true);
}

export async function startBenchServer() {
  const hostname = "127.0.0.1";
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => nextHandler(req, res, benchParsedUrl(req.url)));
    server.keepAliveTimeout = 72_000;
    server.headersTimeout = 75_000;
    server.requestTimeout = 0;
    server.listen(0, hostname, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        url: `http://${hostname}:${port}`,
        port,
        close: () => new Promise((r, j) => server.close((e) => (e ? j(e) : r()))),
      });
    });
    server.once("error", reject);
  });
}
