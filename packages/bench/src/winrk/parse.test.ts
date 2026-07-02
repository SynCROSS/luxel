import { describe, expect, test } from "bun:test";
import { parseWinrkOutput } from "./parse.ts";

describe("parseWinrkOutput", () => {
  test("parses winrk result block", () => {
    const out = parseWinrkOutput(`
Result:
 total: 5733 requests
 errors: 0 errors
 error percentage: 0.0%
 latency min: 1.5ms
 latency median: 2.0ms
 latency average: 2.1ms
 latency max: 9.0ms
 transfers: 1.129 MB per sec
 rps: 942.7 requests per sec
`);
    expect(out.requestsPerSec).toBe(942.7);
    expect(out.latencyMinMs).toBe(1.5);
    expect(out.latencyP50Ms).toBe(2);
    expect(out.latencyAvgMs).toBe(2.1);
    expect(out.latencyMaxMs).toBe(9);
    expect(out.errorRatePercent).toBe(0);
    expect(out.totalRequests).toBe(5733);
    expect(out.totalErrors).toBe(0);
  });
});
