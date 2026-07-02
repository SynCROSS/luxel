import { describe, expect, test } from "bun:test";
import { benchFetch, isBenchConnectError } from "./bench-fetch.ts";

describe("bench-fetch", () => {
  test("isBenchConnectError matches Bun localhost failures", () => {
    expect(isBenchConnectError(new Error("Unable to connect. Is the computer able to access the url?"))).toBe(
      true,
    );
    expect(
      isBenchConnectError(
        new Error(
          "The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch()",
        ),
      ),
    ).toBe(true);
    expect(isBenchConnectError(new Error("probe failed: 500"))).toBe(false);
  });

  test("benchFetch retries socket-closed then succeeds", async () => {
    let calls = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      calls++;
      if (calls < 2) {
        throw new Error(
          "The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch()",
        );
      }
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    try {
      const res = await benchFetch("http://127.0.0.1:1/", {}, { attempts: 5, delayMs: 1 });
      expect(res.status).toBe(200);
      expect(calls).toBe(2);
    } finally {
      globalThis.fetch = original;
    }
  });

  test("benchFetch retries unable-to-connect then succeeds", async () => {
    let calls = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      calls++;
      if (calls < 3) throw new Error("Unable to connect. Is the computer able to access the url?");
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    try {
      const res = await benchFetch("http://127.0.0.1:1/", {}, { attempts: 5, delayMs: 1 });
      expect(res.status).toBe(200);
      expect(calls).toBe(3);
    } finally {
      globalThis.fetch = original;
    }
  });
});
