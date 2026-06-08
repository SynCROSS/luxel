import type { SemanticIr } from "./semantic-ir.ts";
import type { TemplateBinding } from "../resource-store/luxel-data.ts";
import type { DomOp } from "./dom-op.ts";

export function inferTemplateBindings(
  routeId: string,
  semantic: SemanticIr,
  script: string,
  domOps: readonly DomOp[] = [],
): TemplateBinding[] {
  const constKeys = new Map<string, string>();
  for (const m of script.matchAll(/const\s+(\w+)\s*=\s*["']([^"']+)["']/g)) {
    constKeys.set(m[1]!, m[2]!);
  }

  const templateIds = [
    ...new Set(
      semantic.templateExprs.filter((e) => e.kind === "identifier").map((e) => e.raw),
    ),
  ];

  const eventNames = new Set(semantic.eventHandlers);
  const scalarBindings = templateIds
    .filter((id) => id !== "count" && !eventNames.has(id))
    .map((templateId) => {
      const resourceKey = findResourceKeyForField(script, templateId, constKeys) ?? `${routeId}:${templateId}`;
      return { templateId, resourceKey, field: templateId };
    });

  const listIds = collectForLoopListIds(domOps);
  const listBindings = listIds.map((listId) => {
    const resourceKey =
      findResourceKeyForList(script, listId, constKeys) ?? `${routeId}:${listId}`;
    return { templateId: listId, resourceKey, field: listId };
  });

  const seen = new Set<string>();
  return [...scalarBindings, ...listBindings].filter((b) => {
    if (seen.has(b.templateId)) return false;
    seen.add(b.templateId);
    return true;
  });
}

function collectForLoopListIds(ops: readonly DomOp[]): string[] {
  const ids: string[] = [];
  for (const op of ops) {
    if (op.kind === "forLoop") ids.push(op.listId);
    if (op.kind === "element") ids.push(...collectForLoopListIds(op.children));
  }
  return ids;
}

function findResourceKeyForList(
  script: string,
  listId: string,
  constKeys: Map<string, string>,
): string | undefined {
  const matches = [...script.matchAll(/\.set\(\s*([^,]+),\s*\[/g)];
  for (const m of matches) {
    const key = resolveKeyExpr(m[1]!.trim(), constKeys);
    if (!key) continue;
    if (key === listId || key.endsWith(`:${listId}`)) return key;
  }
  if (matches.length === 1) {
    return resolveKeyExpr(matches[0]![1]!.trim(), constKeys);
  }
  return undefined;
}

function resolveKeyExpr(keyExpr: string, constKeys: Map<string, string>): string | undefined {
  if (/^["']/.test(keyExpr)) return keyExpr.slice(1, -1);
  return constKeys.get(keyExpr);
}

function findResourceKeyForField(
  script: string,
  field: string,
  constKeys: Map<string, string>,
): string | undefined {
  for (const m of script.matchAll(/\.set\(\s*([^,]+),\s*\{([^}]*)\}/gs)) {
    const keyExpr = m[1]!.trim();
    const body = m[2]!;
    if (!new RegExp(`\\b${field}\\b`).test(body)) continue;
    return resolveKeyExpr(keyExpr, constKeys);
  }
  return undefined;
}
