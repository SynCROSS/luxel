import { describe, expect, test } from "bun:test";
import { analyzeScript } from "../src/compiler/analyze-script.ts";

describe("analyzeScript", () => {
  test("counter load is static-eligible", () => {
    const script = `
export async function load(ctx) {
  ctx.store.set("route:index:message", { message: "Hello" }, { tags: ["home"] });
}
const count = signal(0);
`;
    const analysis = analyzeScript(script);
    expect(analysis.staticLoadEligible).toBe(true);
    expect(analysis.mode).toBe("ssr");
    expect(analysis.serverFnNames).toEqual([]);
  });

  test("nav-demo infers isr from revalidate export", () => {
    const script = `
export const revalidate = 60;
export async function load(ctx) {
  if (ctx.store.isStale("k")) ctx.store.set("k", { headline: "A" });
}
export async function prefetch(ctx) {}
export async function echoMessage(input: { text: string }) {
  return { reply: input.text };
}
`;
    const analysis = analyzeScript(script);
    expect(analysis.mode).toBe("isr");
    expect(analysis.revalidateSeconds).toBe(60);
    expect(analysis.hasPrefetch).toBe(true);
    expect(analysis.staticLoadEligible).toBe(false);
    expect(analysis.serverFnNames).toEqual(["echoMessage"]);
  });

  test("session read forces ssr mode", () => {
    const script = `
export const prerender = true;
export async function load(ctx) {
  void ctx.session;
}
`;
    expect(analyzeScript(script).mode).toBe("ssr");
  });
});
