import { createFetchServer } from "./http-server.ts";
import { runWinrk } from "./run.ts";

const server = await createFetchServer(async () => new Response("ok"));
try {
  const stats = await runWinrk({ url: server.url, durationSec: 2, connections: 10, threads: 2 });
  console.log(JSON.stringify(stats, null, 2));
} finally {
  await server.close();
}
