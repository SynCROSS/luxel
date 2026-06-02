import { createAppFetch } from "../server/handler.ts";
import { bundleClient } from "../build/client-bundle.ts";

export async function createTestServer(port = 0) {
  const { js, css } = await bundleClient();
  const fetch = createAppFetch({ clientBundle: js, css });
  const server = Bun.serve({ port, fetch });
  return {
    url: `http://${server.hostname}:${server.port}`,
    close: () => server.stop(),
  };
}
