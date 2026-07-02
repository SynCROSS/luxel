import { describe, expect, test } from "bun:test";
import { hydrateSpiralClientGpuLayout } from "@luxel/luxel/client-gpu";

describe("@luxel/luxel/client-gpu export", () => {
  test("hydrateSpiralClientGpuLayout is public", () => {
    expect(typeof hydrateSpiralClientGpuLayout).toBe("function");
  });
});
