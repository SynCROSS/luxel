import type { StackRow } from "./registry.ts";

function parseIdList(raw: string): Set<string> {
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean),
  );
}

export function filterStacks(rows: StackRow[], env: NodeJS.ProcessEnv = process.env): StackRow[] {
  const until = env.WINRK_STACK_UNTIL?.trim().replace(/^["']|["']$/g, "");
  const pick = env.WINRK_STACK?.trim();

  if (until && pick) {
    throw new Error("use WINRK_STACK or WINRK_STACK_UNTIL, not both");
  }

  if (pick) {
    const ids = parseIdList(pick);
    const filtered = rows.filter((r) => ids.has(r.id));
    if (filtered.length === 0) {
      throw new Error(
        `WINRK_STACK matched no stacks (WINRK_STACK=${JSON.stringify(pick)}). fixture ids: ${rows.map((r) => r.id).join(", ")}`,
      );
    }
    const order = new Map(rows.map((r, i) => [r.id, i]));
    return filtered.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }

  if (until) {
    const idx = rows.findIndex((r) => r.id === until);
    if (idx === -1) {
      throw new Error(
        `WINRK_STACK_UNTIL unknown id: ${until}. fixture ids: ${rows.map((r) => r.id).join(", ")}`,
      );
    }
    return rows.slice(0, idx + 1);
  }

  return rows;
}
