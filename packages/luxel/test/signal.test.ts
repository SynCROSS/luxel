import { describe, expect, test } from "bun:test";
import { effect, signal } from "../src/runtime/signal.ts";

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

  test("effect re-runs when a read signal changes", () => {
    const rows = signal<string[]>([]);
    let runs = 0;
    let lastLen = -1;

    effect(() => {
      runs++;
      lastLen = rows.value.length;
    });

    expect(runs).toBe(1);
    expect(lastLen).toBe(0);

    rows.value = ["a", "b", "c"];
    expect(runs).toBe(2);
    expect(lastLen).toBe(3);
  });
});
