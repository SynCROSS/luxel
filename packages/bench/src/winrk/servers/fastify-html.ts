import {
  createFastifyHtmlCounterServer,
  createFastifyHtmlSpiralServer,
} from "@luxel/luxel/bench";
import type { BenchServer } from "../http-server.ts";

function toBenchServer(server: {
  url: string;
  port: number;
  close: () => Promise<void>;
}): BenchServer {
  return { url: server.url, port: server.port, close: server.close };
}

export async function startFastifyHtmlCounterServer(): Promise<BenchServer> {
  return toBenchServer(await createFastifyHtmlCounterServer());
}

export async function startFastifyHtmlSpiralServer(): Promise<BenchServer> {
  return toBenchServer(await createFastifyHtmlSpiralServer());
}
