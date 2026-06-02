import { LuxelCompileError } from "./diagnostics.ts";
import { parseSfc } from "./parse-sfc.ts";

export type TemplateExpr = {
  kind: "identifier" | "member" | "literal";
  raw: string;
};

export type SemanticIr = {
  templateExprs: TemplateExpr[];
  hasHydrateLoad: boolean;
  hasUnsafeHtml: boolean;
  eventHandlers: string[];
};

const EXPR_RE = /\{([^}]+)\}/g;

export function compileSemanticIr(source: string): SemanticIr {
  const sfc = parseSfc(source);
  const templateExprs: TemplateExpr[] = [];
  const eventHandlers: string[] = [];

  if (/unsafe:html/i.test(source)) {
    throw new LuxelCompileError([
      { code: "LUXEL_FORBIDDEN_UNSAFE_HTML", message: "`unsafe:html` is forbidden in prototype" },
    ]);
  }

  const hasHydrateLoad = /\shydrate:load(?:\s|>|=)/i.test(sfc.template);

  for (const m of sfc.template.matchAll(EXPR_RE)) {
    const raw = m[1].trim();
    templateExprs.push(classifyExpr(raw));
  }

  for (const m of sfc.template.matchAll(/\bon:(\w+)=\{([^}]+)\}/g)) {
    eventHandlers.push(m[2].trim());
  }

  return {
    templateExprs,
    hasHydrateLoad,
    hasUnsafeHtml: false,
    eventHandlers,
  };
}

function classifyExpr(raw: string): TemplateExpr {
  if (/^["'`]/.test(raw) || /^-?\d+(\.\d+)?$/.test(raw)) {
    return { kind: "literal", raw };
  }
  if (/^[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)*$/.test(raw)) {
    return raw.includes(".") ? { kind: "member", raw } : { kind: "identifier", raw };
  }
  throw new LuxelCompileError([
    {
      code: "LUXEL_IMPURE_TEMPLATE_EXPR",
      message: `Template expression not allowed: ${raw}`,
    },
  ]);
}
