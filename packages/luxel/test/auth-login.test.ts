import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAuthTestServer } from "../src/test/auth-server.ts";

describe("auth login", () => {
  test("reference provider login sets session cookie readable on next SSR", async () => {
    const dir = await mkdtemp(join(tmpdir(), "luxel-auth-"));
    const server = await createAuthTestServer(dir);
    try {
      const login = await fetch(`${server.url}/__luxel/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "dev@luxel.local", password: "luxel-dev" }),
      });
      expect(login.status).toBe(204);
      const cookie = login.headers.get("set-cookie");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");

      const account = await fetch(`${server.url}/account`, {
        headers: { cookie: cookie!.split(";")[0]! },
      });
      expect(account.status).toBe(200);
      expect(await account.text()).toContain("Hello dev-user");
    } finally {
      server.close();
    }
  });

  test("logout clears session cookie", async () => {
    const dir = await mkdtemp(join(tmpdir(), "luxel-auth-"));
    const server = await createAuthTestServer(dir);
    try {
      const login = await fetch(`${server.url}/__luxel/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "dev@luxel.local", password: "luxel-dev" }),
      });
      const cookie = login.headers.get("set-cookie")!;
      const logout = await fetch(`${server.url}/__luxel/auth/logout`, {
        method: "POST",
        headers: { cookie: cookie.split(";")[0]! },
      });
      expect(logout.status).toBe(204);
      expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    } finally {
      server.close();
    }
  });
});
