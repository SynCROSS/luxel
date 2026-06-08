import { createFetchServer } from "./http-server.ts";
import { spawnSync } from "node:child_process";
import { resolveWinrk } from "./resolve.ts";

const server = await createFetchServer(async () =>
  new Response("<html><body>ok</body></html>", { headers: { "content-type": "text/html" } }),
);
console.log("server", server.url);
const probe = await fetch(server.url);
console.log("probe", probe.status, await probe.text());

const winrk = resolveWinrk();
const result = spawnSync(winrk, [server.url, "-d", "3", "-c", "20", "-t", "2"], {
  encoding: "utf8",
  windowsHide: true,
});
console.log("exit", result.status);
console.log("stdout", JSON.stringify(result.stdout));
console.log("stderr", JSON.stringify(result.stderr));
await server.close();
