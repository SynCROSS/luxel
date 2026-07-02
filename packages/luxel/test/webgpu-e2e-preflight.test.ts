import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  WEBGPU_E2E_PREFLIGHT_PATH,
  readWebgpuE2ePreflight,
  webgpuE2eSkipReason,
} from "../../../tests/e2e/webgpu-preflight.ts";

describe("webgpu e2e preflight", () => {
  const prevSkip = process.env.LUXEL_WEBGPU_SKIP;

  beforeEach(() => {
    mkdirSync(dirname(WEBGPU_E2E_PREFLIGHT_PATH), { recursive: true });
    rmSync(WEBGPU_E2E_PREFLIGHT_PATH, { force: true });
    delete process.env.LUXEL_WEBGPU_SKIP;
  });

  afterEach(() => {
    rmSync(WEBGPU_E2E_PREFLIGHT_PATH, { force: true });
    if (prevSkip === undefined) delete process.env.LUXEL_WEBGPU_SKIP;
    else process.env.LUXEL_WEBGPU_SKIP = prevSkip;
  });

  test("no marker -> no skip reason", () => {
    expect(readWebgpuE2ePreflight()).toBeNull();
    expect(webgpuE2eSkipReason()).toBeNull();
  });

  test("preflight skip marker -> skip reason", () => {
    writeFileSync(WEBGPU_E2E_PREFLIGHT_PATH, JSON.stringify({ skip: true, reason: "launch timeout" }));
    expect(readWebgpuE2ePreflight()?.skip).toBe(true);
    expect(webgpuE2eSkipReason()).toBe("launch timeout");
  });

  test("LUXEL_WEBGPU_SKIP=1 -> skip reason", () => {
    process.env.LUXEL_WEBGPU_SKIP = "1";
    expect(webgpuE2eSkipReason()).toBe("LUXEL_WEBGPU_SKIP=1");
  });
});
