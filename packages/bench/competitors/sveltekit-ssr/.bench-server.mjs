import { handler } from "./build/handler.js";
import { createServer } from "node:http";
export async function startBenchServer() {
  const hostname = "127.0.0.1";
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => handler(req, res, () => {}));
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
