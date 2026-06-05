import { createTestServer, createNavDemoTestServer } from "../src/test/server.ts";

const port = Number(process.env.LUXEL_E2E_PORT ?? 4173);
const appDir = process.env.LUXEL_E2E_APP ?? "examples/counter";
const server =
  appDir === "examples/nav-demo"
    ? await createNavDemoTestServer(port)
    : await createTestServer(port);
console.log(`e2e server ${server.url}`);

process.on("SIGINT", () => server.close());
