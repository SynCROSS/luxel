import { describe, expect, test } from "bun:test";
import { parseOhaOutput } from "./parse-oha.ts";

const SAMPLE = `Summary:
  Success rate:	100.00%
  Total:	2009.0763 ms
  Slowest:	489.5577 ms
  Fastest:	0.0703 ms
  Average:	0.4967 ms
  Requests/sec:	36675.5608

Response time distribution:
  50.00% in 0.3678 ms
  99.00% in 1.3938 ms

Status code distribution:
  [200] 73664 responses

Error distribution:
  [20] aborted due to deadline
`;

describe("parseOhaOutput", () => {
  test("maps oha stats to winrk-shaped result", () => {
    const out = parseOhaOutput(SAMPLE);
    expect(out.requestsPerSec).toBeCloseTo(36675.5608, 2);
    expect(out.latencyP50Ms).toBeCloseTo(0.3678, 3);
    expect(out.latencyMaxMs).toBeCloseTo(489.5577, 3);
    expect(out.totalRequests).toBe(73664);
    expect(out.errorRatePercent).toBe(0);
    expect(out.totalErrors).toBe(0);
  });

  test("counts non-2xx status codes as errors", () => {
    const out = parseOhaOutput(`Summary:
  Success rate:	99.00%
  Requests/sec:	1000.0
Status code distribution:
  [200] 990 responses
  [500] 10 responses
`);
    expect(out.totalErrors).toBe(10);
    expect(out.errorRatePercent).toBe(1);
  });

  test("rejects empty output", () => {
    expect(() => parseOhaOutput("")).toThrow(/missing Requests\/sec/);
  });
});
