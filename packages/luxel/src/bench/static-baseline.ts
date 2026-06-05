import { counterDocumentFromBody, COUNTER_MINIMAL_BODY } from "./fixtures/counter-contract.ts";
import { runPerRequestSsrBench } from "./competitors/throughput-harness.ts";

/** Reference HTTP baseline (fixed HTML body, no per-request render). */
export async function runStaticHttpBaseline(): Promise<{ throughputRps: number; htmlBytes: number }> {
  const html = counterDocumentFromBody(COUNTER_MINIMAL_BODY);
  return runPerRequestSsrBench(async () => html, 500);
}
