import { describe, expect, test } from "bun:test";
import { killProcessTree } from "../src/util/kill-process-tree.ts";
import {
  installKrausestAbortHooks,
  killTrackedKrausestChildren,
  trackKrausestChild,
} from "../src/bench/krausest/abort.ts";

describe("killProcessTree", () => {
  test("no-ops on missing or invalid pid", () => {
    expect(() => killProcessTree(undefined)).not.toThrow();
    expect(() => killProcessTree(null)).not.toThrow();
    expect(() => killProcessTree(0)).not.toThrow();
    expect(() => killProcessTree(-1)).not.toThrow();
  });
});

describe("krausest abort tracking", () => {
  test("track forgets pid on exit event without needing kill", () => {
    let exitHandler: (() => void) | undefined;
    const fake = {
      pid: 42,
      once: (event: string, fn: () => void) => {
        if (event === "exit") exitHandler = fn;
        return fake;
      },
    } as unknown as import("node:child_process").ChildProcess;
    trackKrausestChild(fake);
    exitHandler?.();
    expect(() => killTrackedKrausestChildren()).not.toThrow();
  });

  test("installKrausestAbortHooks is idempotent", () => {
    expect(() => {
      installKrausestAbortHooks();
      installKrausestAbortHooks();
    }).not.toThrow();
  });
});
