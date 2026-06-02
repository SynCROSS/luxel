import { createTestServer } from "../src/test/server.ts";

const port = Number(process.env.LUXEL_E2E_PORT ?? 4173);
const server = await createTestServer(port);
console.log(`e2e server ${server.url}`);

process.on("SIGINT", () => server.close());
