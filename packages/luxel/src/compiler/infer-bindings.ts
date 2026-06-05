import type { SemanticIr } from "./semantic-ir.ts";
import type { TemplateBinding } from "../resource-store/luxel-data.ts";

export function inferTemplateBindings(
  routeId: string,
  semantic: SemanticIr,
  script: string,
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
  return templateIds
    .filter((id) => id !== "count" && !eventNames.has(id))
    .map((templateId) => {
      const resourceKey = findResourceKeyForField(script, templateId, constKeys) ?? `${routeId}:${templateId}`;
      return { templateId, resourceKey, field: templateId };
    });
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
    if (/^["']/.test(keyExpr)) {
      return keyExpr.slice(1, -1);
    }
    return constKeys.get(keyExpr);
  }
  return undefined;
}
