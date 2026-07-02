import {
  createStaticHttpCounterServer,
  createStaticHttpSpiralServer,
} from "@luxel/luxel/bench";
import type { BenchServer } from "../http-server.ts";

function toBenchServer(server: {
  url: string;
  port: number;
  close: () => Promise<void>;
}): BenchServer {
  return { url: server.url, port: server.port, close: server.close };
}

export async function startStaticHttpCounterServer(): Promise<BenchServer> {
  return toBenchServer(await createStaticHttpCounterServer());
}

export async function startStaticHttpSpiralServer(): Promise<BenchServer> {
  return toBenchServer(await createStaticHttpSpiralServer());
}
