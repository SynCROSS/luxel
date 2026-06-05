import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAuthTestServer } from "../src/test/auth-server.ts";

describe("server functions", () => {
  test("JSON RPC invokes manifest id with session CSRF", async () => {
    const dir = await mkdtemp(join(tmpdir(), "luxel-sfn-"));
    const server = await createAuthTestServer(dir);
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
          id: "route:index:echoMessage",
          input: { text: "hi" },
        }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ reply: "HI" });
    } finally {
      server.close();
    }
  });

  test("HTML form POST invokes server fn", async () => {
    const dir = await mkdtemp(join(tmpdir(), "luxel-sfn-"));
    const server = await createAuthTestServer(dir);
    try {
      const login = await fetch(`${server.url}/__luxel/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "dev@luxel.local", password: "luxel-dev" }),
      });
      const cookie = login.headers.get("set-cookie")!;
      const csrf = login.headers.get("x-luxel-csrf")!;
      const body = new URLSearchParams({
        "luxel-fn-id": "route:index:echoMessage",
        "luxel-fn-input": JSON.stringify({ text: "form" }),
        "luxel-csrf": csrf,
      });
      const res = await fetch(`${server.url}/__luxel/fn`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: cookie.split(";")[0]!,
          origin: server.url,
        },
        body,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ reply: "FORM" });
    } finally {
      server.close();
    }
  });

  test("wrong CSRF rejected", async () => {
    const dir = await mkdtemp(join(tmpdir(), "luxel-sfn-"));
    const server = await createAuthTestServer(dir);
    try {
      const login = await fetch(`${server.url}/__luxel/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "dev@luxel.local", password: "luxel-dev" }),
      });
      const cookie = login.headers.get("set-cookie")!;
      const res = await fetch(`${server.url}/__luxel/fn`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookie.split(";")[0]!,
          "x-luxel-csrf": "bad",
          origin: server.url,
        },
        body: JSON.stringify({
          id: "route:index:echoMessage",
          input: { text: "hi" },
        }),
      });
      expect(res.status).toBe(403);
    } finally {
      server.close();
    }
  });
});
