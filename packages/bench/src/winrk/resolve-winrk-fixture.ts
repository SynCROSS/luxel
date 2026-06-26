import { stacksForFixture, type WinrkFixtureId } from "./registry.ts";

function parseIdList(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function stackIdsForBisect(env: NodeJS.ProcessEnv): string[] {
  const ids: string[] = [];
  if (env.WINRK_STACK?.trim()) ids.push(...parseIdList(env.WINRK_STACK));
  if (env.WINRK_STACK_UNTIL?.trim()) {
    ids.push(env.WINRK_STACK_UNTIL.trim().replace(/^["']|["']$/g, ""));
  }
  return ids;
}

export function fixtureForStackIds(ids: string[]): WinrkFixtureId | null {
  if (ids.length === 0) return null;
  const counterIds = new Set(stacksForFixture("counter").map((row) => row.id));
  const spiralIds = new Set(stacksForFixture("spiral").map((row) => row.id));
  let sawCounter = false;
  let sawSpiral = false;
  for (const id of ids) {
    if (counterIds.has(id)) sawCounter = true;
    else if (spiralIds.has(id)) sawSpiral = true;
    else return null;
  }
  if (sawCounter && sawSpiral) {
    throw new Error(
      "WINRK_STACK spans counter + spiral fixtures — set WINRK_FIXTURE=counter or WINRK_FIXTURE=spiral",
    );
  }
  if (sawSpiral) return "spiral";
  if (sawCounter) return "counter";
  return null;
}

export type ResolveWinrkFixtureResult =
  | { fixture: WinrkFixtureId; notice?: string }
  | { fatal: string };

function explicitFixtureFromEnv(norm: string | undefined): WinrkFixtureId | null {
  if (norm === "spiral") return "spiral";
  if (!norm || norm === "counter") return "counter";
  return null;
}

function bisectNotice(
  env: NodeJS.ProcessEnv,
  norm: string | undefined,
  inferred: WinrkFixtureId,
  explicit: WinrkFixtureId | null,
): string | undefined {
  if (norm === "all") {
    return `WINRK_FIXTURE=all ignored — bisect uses ${inferred} (from stack filter)`;
  }
  if (explicit && explicit !== inferred) {
    return `WINRK_FIXTURE=${JSON.stringify(env.WINRK_FIXTURE)} ignored — bisect uses ${inferred} (from stack filter)`;
  }
  return undefined;
}

export function resolveWinrkFixture(env: NodeJS.ProcessEnv = process.env): ResolveWinrkFixtureResult {
  const norm = env.WINRK_FIXTURE?.trim().replace(/^["']|["']$/g, "").toLowerCase();
  const stackIds = stackIdsForBisect(env);
  if (stackIds.length > 0) {
    try {
      const inferred = fixtureForStackIds(stackIds);
      if (inferred) {
        return {
          fixture: inferred,
          notice: bisectNotice(env, norm, inferred, explicitFixtureFromEnv(norm)),
        };
      }
    } catch (err) {
      return { fatal: err instanceof Error ? err.message : String(err) };
    }
  }

  if (norm === "spiral") return { fixture: "spiral" };
  if (norm === "all") {
    return {
      fatal: [
        "WINRK_FIXTURE=all removed — run counter + spiral in separate Bun processes (fresh memory per fixture).",
        "  bun run bench:repro",
        "  bun run bench:winrk:repro-all",
        "Bisect one stack: unset WINRK_FIXTURE or set WINRK_FIXTURE=counter|spiral with WINRK_STACK=<id>",
      ].join("\n"),
    };
  }
  if (norm && norm !== "counter" && norm !== "") {
    return {
      fixture: "counter",
      notice: `unknown WINRK_FIXTURE=${JSON.stringify(env.WINRK_FIXTURE)} — defaulting to counter`,
    };
  }
  return { fixture: "counter" };
}
