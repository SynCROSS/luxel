import "./winrk/apply-bench-host-env.ts";
import "@luxel/luxel/bench";
import { runWinrkStack, stacksForFixture, type WinrkFixtureId } from "./winrk/registry.ts";
import { filterStacks } from "./winrk/stack-filter.ts";

function parseFixture(raw: string | undefined): WinrkFixtureId {
  const norm = raw?.trim().replace(/^["']|["']$/g, "").toLowerCase();
  return norm === "spiral" ? "spiral" : "counter";
}

const stackId = process.env.WINRK_STACK?.trim().replace(/^["']|["']$/g, "");
if (!stackId) {
  console.error("WINRK_STACK required for isolated stack run");
  process.exit(1);
}

const fixture = parseFixture(process.env.WINRK_FIXTURE);
const rows = filterStacks(stacksForFixture(fixture), { WINRK_STACK: stackId });
if (rows.length !== 1) {
  console.error(`expected exactly one stack for WINRK_STACK=${stackId}, got ${rows.length}`);
  process.exit(1);
}

const result = await runWinrkStack(rows[0]!);
console.log(JSON.stringify({ fixture, ...result }));
