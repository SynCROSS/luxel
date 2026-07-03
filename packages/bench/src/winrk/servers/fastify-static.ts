import {
  createFastifyStaticCounterServer,
  createFastifyStaticSpiralServer,
} from "@luxel/luxel/bench";
import type { BenchServer } from "../http-server.ts";

function toBenchServer(server: {
  url: string;
  port: number;
  close: () => Promise<void>;
}): BenchServer {
  return { url: server.url, port: server.port, close: server.close };
}

export async function startFastifyStaticCounterServer(): Promise<BenchServer> {
  return toBenchServer(await createFastifyStaticCounterServer());
}

export async function startFastifyStaticSpiralServer(): Promise<BenchServer> {
  return toBenchServer(await createFastifyStaticSpiralServer());
}
