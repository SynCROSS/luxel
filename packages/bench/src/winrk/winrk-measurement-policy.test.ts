import { afterEach, describe, expect, test } from "bun:test";
import {
  benchWinrkMeasurementRetryAttempts,
  shouldRetryWinrkMeasurement,
  winrkMeasurementHasErrors,
} from "./winrk-measurement-policy.ts";

const ENV_KEY = "BENCH_WINRK_RETRY_ATTEMPTS";

describe("winrk measurement policy", () => {
  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  test("detects raw WinRK errors", () => {
    expect(
      winrkMeasurementHasErrors({
        requestsPerSec: 1,
        totalErrors: 16,
        errorRatePercent: 0,
        raw: "",
      }),
    ).toBe(true);
  });

  test("detects rounded error rate when raw count missing", () => {
    expect(
      winrkMeasurementHasErrors({
        requestsPerSec: 1,
        errorRatePercent: 0.01,
        raw: "",
      }),
    ).toBe(true);
  });

  test("clean measurement has no errors", () => {
    expect(
      winrkMeasurementHasErrors({
        requestsPerSec: 1,
        totalErrors: 0,
        errorRatePercent: 0,
        raw: "",
      }),
    ).toBe(false);
  });

  test("retry while attempts remain", () => {
    expect(shouldRetryWinrkMeasurement(1, 3)).toBe(true);
    expect(shouldRetryWinrkMeasurement(2, 3)).toBe(true);
    expect(shouldRetryWinrkMeasurement(3, 3)).toBe(false);
  });

  test("env overrides Windows retry default", () => {
    process.env[ENV_KEY] = "5";
    expect(benchWinrkMeasurementRetryAttempts()).toBe(5);
  });
});
