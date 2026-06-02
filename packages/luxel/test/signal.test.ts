import { describe, expect, test } from "bun:test";
import { signal } from "../src/runtime/signal.ts";

describe("signal runtime", () => {
  test("updates subscribers", () => {
    const count = signal(0);
    let seen = 0;
    count.subscribe(() => {
      seen = count.value;
    });
    count.value = 1;
    expect(seen).toBe(1);
  });
});
