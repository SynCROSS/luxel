import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stackObservabilityFromResult } from "./run-output.ts";
import type { WinrkBenchResult } from "./registry.ts";

describe("stackObservabilityFromResult", () => {
  test("ok row includes parsed metrics and raw load-tester output", () => {
    const row = {
      id: "react-fastify-ssr",
      status: "ok",
      requestsPerSec: 1234.5,
      latencyP50Ms: 2.3,
      latencyP95Ms: 4.5,
      errorRatePercent: 0,
      winrk: { requestsPerSec: 1234.5, raw: "Requests/sec: 1234.50" },
    } as WinrkBenchResult;

    expect(stackObservabilityFromResult(row, "2026-01-01T00:00:00.000Z")).toEqual({
      stackId: "react-fastify-ssr",
      status: "ok",
      generatedAt: "2026-01-01T00:00:00.000Z",
      requestsPerSec: 1234.5,
      latencyP50Ms: 2.3,
      latencyP95Ms: 4.5,
      errorRatePercent: 0,
      raw: "Requests/sec: 1234.50",
    });
  });

  test("pending row keeps reason without metrics", () => {
    const row = {
      id: "react-rsc",
      status: "pending",
      reason: "run competitors build",
    } as WinrkBenchResult;

    expect(stackObservabilityFromResult(row, "2026-01-01T00:00:00.000Z")).toEqual({
      stackId: "react-rsc",
      status: "pending",
      generatedAt: "2026-01-01T00:00:00.000Z",
      reason: "run competitors build",
    });
  });

  test("writeStackObservabilityLine overwrites prior run after reset", async () => {
    const root = await mkdtemp(join(tmpdir(), "luxel-winrk-stacks-"));
    const fixtureDir = join(root, "docs/benchmarks/runs/stacks/counter");
    await mkdir(fixtureDir, { recursive: true });
    await writeFile(
      join(fixtureDir, "react-ssr.jsonl"),
      `${JSON.stringify({ stackId: "react-ssr", status: "ok", stale: true })}\n`,
    );

    const prevRepoRoot = process.env.LUXEL_WINRK_REPO_ROOT;
    process.env.LUXEL_WINRK_REPO_ROOT = root;
    try {
      const { resetStackObservabilityDir, writeStackObservabilityLine } = await import("./run-output.ts");
      await resetStackObservabilityDir("counter");
      await writeStackObservabilityLine("counter", {
        stackId: "react-ssr",
        status: "ok",
        generatedAt: "2026-01-02T00:00:00.000Z",
        requestsPerSec: 99,
        raw: "fresh",
      });

      const contents = await readFile(join(fixtureDir, "react-ssr.jsonl"), "utf8");
      expect(JSON.parse(contents.trim())).toEqual({
        stackId: "react-ssr",
        status: "ok",
        generatedAt: "2026-01-02T00:00:00.000Z",
        requestsPerSec: 99,
        raw: "fresh",
      });
    } finally {
      if (prevRepoRoot === undefined) delete process.env.LUXEL_WINRK_REPO_ROOT;
      else process.env.LUXEL_WINRK_REPO_ROOT = prevRepoRoot;
    }
  });
});
