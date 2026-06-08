import { createServer } from "node:http";
import { b as useNitroApp, t as toNodeListener } from "./.output/server/chunks/_/nitro.mjs";

export async function startBenchServer() {
  const hostname = "127.0.0.1";
  const nitroApp = useNitroApp();
  return new Promise((resolve, reject) => {
    const server = createServer(toNodeListener(nitroApp.h3App));
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