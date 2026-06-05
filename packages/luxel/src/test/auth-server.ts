import { join } from "node:path";
import { createAppFetch } from "../server/handler.ts";
import { bundleClient } from "../build/client-bundle.ts";
import { compileApp } from "../route/compile-app.ts";
import { SqliteSessionStore } from "../auth/sqlite-session-store.ts";
import { DevCredentialsProvider } from "../auth/provider.ts";
import type { AuthProvider } from "../auth/provider.ts";
import type { SessionStoreAdapter } from "../auth/session.ts";
import { buildServerFnRegistry } from "../server/server-fn.ts";
import { createListenFetchServer } from "./http-server.ts";

export type AuthServerOptions = {
  sessionDbPath: string;
  authProvider?: AuthProvider;
  appDir?: string;
};

export async function createAuthTestServer(
  sessionDbPath: string,
  port = 0,
  appDir = "examples/nav-demo",
) {
  const repoRoot = join(import.meta.dir, "../../../..");
  const app = await compileApp(repoRoot, appDir);
  const genRoot = await app.writeCache();
  const { js } = await bundleClient(genRoot);
  const dbFile = sessionDbPath.endsWith(".sqlite")
    ? sessionDbPath
    : join(sessionDbPath, "sessions.sqlite");
  const sessionStore: SessionStoreAdapter = new SqliteSessionStore(dbFile);
  const authProvider = new DevCredentialsProvider();
  const serverFnRegistry = buildServerFnRegistry(app);
  const fetch = createAppFetch({
    app,
    clientBundle: js,
    internalRoutes: true,
    sessionStore,
    authProvider,
    serverFnRegistry,
  });
  const hostname = "127.0.0.1";
  const server = await createListenFetchServer(fetch, { port, hostname });
  return {
    url: server.url,
    close: () => server.close(),
  };
}
