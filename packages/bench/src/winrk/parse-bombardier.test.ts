import { describe, expect, test } from "bun:test";
import { parseBombardierOutput } from "./parse-bombardier.ts";

const SAMPLE = `Statistics        Avg      Stdev        Max
  Reqs/sec      6607.00     524.56       7109
  Latency       29.86ms     5.36ms   305.02ms
  Latency Distribution
     50%    28.00ms
     75%    32.00ms
     90%    34.00ms
     99%    48.00ms
  HTTP codes:
    1xx - 0, 2xx - 1000, 3xx - 0, 4xx - 5, 5xx - 0
    others - 2
`;

describe("parseBombardierOutput", () => {
  test("maps bombardier stats to winrk-shaped result", () => {
    const out = parseBombardierOutput(SAMPLE);
    expect(out.requestsPerSec).toBe(6607);
    expect(out.latencyP50Ms).toBe(28);
    expect(out.totalRequests).toBe(1007);
    expect(out.totalErrors).toBe(7);
    expect(out.errorRatePercent).toBeCloseTo(0.6951, 3);
  });

  test("rejects empty output (e.g. bombardier --no-print)", () => {
    expect(() => parseBombardierOutput("")).toThrow(/missing Reqs\/sec/);
  });
});
