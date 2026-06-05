import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "../src/build/build-app.ts";
import { createAuthTestServer } from "../src/test/auth-server.ts";

const repoRoot = join(import.meta.dir, "../../..");

describe("docs-site integration", () => {
  test("SSG home builds", async () => {
    const outDir = await buildApp(repoRoot, "examples/docs-site");
    const html = await Bun.file(join(outDir, "static", "index.html")).text();
    expect(html).toContain("Luxel docs");
  });

  test("playground server fn works with auth", async () => {
    const dir = await mkdtemp(join(tmpdir(), "luxel-docs-"));
    const server = await createAuthTestServer(dir, 0, "examples/docs-site");
    try {
      const login = await fetch(`${server.url}/__luxel/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "dev@luxel.local", password: "luxel-dev" }),
      });
      const cookie = login.headers.get("set-cookie")!;
      const csrf = login.headers.get("x-luxel-csrf")!;
      const res = await fetch(`${server.url}/__luxel/fn`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookie.split(";")[0]!,
          "x-luxel-csrf": csrf,
          origin: server.url,
        },
        body: JSON.stringify({
          id: "route:playground:echoDocs",
          input: { text: "ok" },
        }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ reply: "docs:ok" });
    } finally {
      server.close();
    }
  });
});
