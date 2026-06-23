import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { createNodeHandlerWorkerPool } from "./create-node-handler-pool.ts";

const echoBootstrapPath = fileURLToPath(
  new URL("./fixtures/echo-handler-bootstrap.mjs", import.meta.url),
);

function captureProcessWarnings() {
  const messages: string[] = [];
  const onWarning = (warning: Error) => {
    messages.push(warning.message);
  };
  process.on("warning", onWarning);
  return {
    messages,
    stop() {
      process.off("warning", onWarning);
    },
  };
}

describe("node handler worker pool", () => {
  test("single worker resolves many concurrent jobs", async () => {
    const pool = createNodeHandlerWorkerPool(echoBootstrapPath, 1);
    try {
      const results = await Promise.all(
        Array.from({ length: 24 }, (_, i) =>
          pool.run({
            method: "GET",
            url: `/job-${i}`,
            headers: {},
            bodyBase64: "",
          }),
        ),
      );
      expect(results).toHaveLength(24);
      for (let i = 0; i < 24; i++) {
        expect(results[i]!.statusCode).toBe(200);
        expect(results[i]!.body.toString()).toBe(`path:/job-${i}`);
      }
    } finally {
      await pool.close();
    }
  });

  test("single worker concurrent jobs emit no MaxListeners warning", async () => {
    const warnings = captureProcessWarnings();
    const pool = createNodeHandlerWorkerPool(echoBootstrapPath, 1);
    try {
      await Promise.all(
        Array.from({ length: 24 }, (_, i) =>
          pool.run({
            method: "GET",
            url: `/job-${i}`,
            headers: {},
            bodyBase64: "",
          }),
        ),
      );
      expect(warnings.messages.some((message) => message.includes("MaxListeners"))).toBe(false);
    } finally {
      await pool.close();
      warnings.stop();
    }
  });
});
