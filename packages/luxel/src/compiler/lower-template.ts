import { LuxelCompileError } from "./diagnostics.ts";
import type { DomOp } from "./dom-op.ts";
import type { BindPoint } from "./dom-op.ts";
import { classifyExpr } from "./semantic-ir.ts";

type Token =
  | { kind: "open"; tag: string; attrs: string; selfClose: boolean }
  | { kind: "close"; tag: string }
  | { kind: "expr"; raw: string }
  | { kind: "text"; raw: string }
  | { kind: "eachOpen"; listId: string; itemName: string }
  | { kind: "eachClose" };

export type LoweredTemplate = {
  domOps: DomOp[];
  bindPoints: BindPoint[];
  boundaryIds: string[];
};

let boundarySeq = 0;

export function lowerTemplateToDomOps(template: string): LoweredTemplate {
  boundarySeq = 0;
  const bindPoints: BindPoint[] = [];
  const boundaryIds: string[] = [];
  const tokens = tokenize(template.trim());
  const { ops: domOps } = parseOps(tokens, 0, bindPoints, boundaryIds, "root");
  return { domOps, bindPoints, boundaryIds };
}

type ParseStop = "root" | "element" | "each";

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i]!)) {
      i++;
      continue;
    }
    if (source[i] === "{") {
      if (source.startsWith("{/each}", i)) {
        tokens.push({ kind: "eachClose" });
        i += "{/each}".length;
        continue;
      }
      if (source.startsWith("{#each", i)) {
        const end = source.indexOf("}", i);
        if (end < 0) throw parseError("unclosed each block");
        const raw = source.slice(i + 1, end).trim();
        const eachMatch = raw.match(/^#each\s+(\w+)\s+as\s+(\w+)$/);
        if (!eachMatch) throw parseError(`invalid each block: ${raw}`);
        tokens.push({ kind: "eachOpen", listId: eachMatch[1]!, itemName: eachMatch[2]! });
        i = end + 1;
        continue;
      }
      const end = source.indexOf("}", i);
      if (end < 0) throw parseError("unclosed expression");
      tokens.push({ kind: "expr", raw: source.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }
    if (source[i] !== "<") {
      let j = i;
      while (j < source.length && source[j] !== "<" && source[j] !== "{") j++;
      const raw = source.slice(i, j).trim();
      if (raw) tokens.push({ kind: "text", raw });
      i = j;
      continue;
    }
    const end = source.indexOf(">", i);
    if (end < 0) throw parseError("unclosed tag");
    const tagSource = source.slice(i + 1, end).trim();
    i = end + 1;
    if (tagSource.startsWith("/")) {
      tokens.push({ kind: "close", tag: tagSource.slice(1).split(/\s/)[0]! });
      continue;
    }
    const selfClose = tagSource.endsWith("/");
    const inner = selfClose ? tagSource.slice(0, -1).trim() : tagSource;
    const space = inner.search(/\s/);
    const tag = (space < 0 ? inner : inner.slice(0, space)).trim();
    const attrs = space < 0 ? "" : inner.slice(space + 1).trim();
    tokens.push({ kind: "open", tag, attrs, selfClose });
  }
  return tokens;
}

function parseOps(
  tokens: Token[],
  pos: number,
  bindPoints: BindPoint[],
  boundaryIds: string[],
  stop: ParseStop,
): { ops: DomOp[]; pos: number } {
  const ops: DomOp[] = [];
  while (pos < tokens.length) {
    const tok = tokens[pos]!;
    if (tok.kind === "eachClose" && stop === "each") return { ops, pos };
    if (tok.kind === "close" && stop === "each") throw parseError("missing {/each}");
    if (tok.kind === "close" && stop === "element") return { ops, pos };

    if (tok.kind === "text") {
      ops.push({ kind: "text", expr: { kind: "literal", raw: JSON.stringify(tok.raw) } });
      pos++;
      continue;
    }

    if (tok.kind === "eachOpen") {
      pos++;
      const inner = parseOps(tokens, pos, bindPoints, boundaryIds, "each");
      if (tokens[inner.pos]?.kind !== "eachClose") {
        throw parseError("missing {/each}");
      }
      pos = inner.pos + 1;
      ops.push({
        kind: "forLoop",
        listId: tok.listId,
        itemName: tok.itemName,
        body: inner.ops,
      });
      continue;
    }

    if (tok.kind === "eachClose") {
      throw parseError("unexpected {/each}");
    }

    if (tok.kind === "expr") {
      ops.push({ kind: "text", expr: classifyExpr(tok.raw) });
      if (tok.raw === "count") bindPoints.push({ id: "count", kind: "text", expr: tok.raw });
      pos++;
      continue;
    }

    if (tok.kind !== "open") {
      throw parseError(`unexpected token in template`);
    }
    const { tag, attrs: attrStr, selfClose } = tok;
    pos++;
    const attrs = parseAttrs(attrStr, bindPoints);
    const hydrate = attrStr.match(/\bhydrate:(\w+)/);

    if (hydrate) {
      const directive = hydrate[1]!;
      const id = `boundary:${boundarySeq++}`;
      boundaryIds.push(id);
      const cleanAttrs = { ...attrs };
      for (const key of Object.keys(cleanAttrs)) {
        if (key.startsWith("hydrate:")) delete cleanAttrs[key];
      }
      ops.push({ kind: "boundaryStart", id, directive });
      let children: DomOp[] = [];
      if (!selfClose) {
        const inner = parseOps(tokens, pos, bindPoints, boundaryIds, "element");
        children = inner.ops;
        pos = inner.pos;
        if (tokens[pos]?.kind === "close") pos++;
      }
      ops.push({ kind: "element", tag, attrs: cleanAttrs, children });
      ops.push({ kind: "boundaryEnd", id });
      continue;
    }

    let children: DomOp[] = [];
    if (!selfClose) {
      const inner = parseOps(tokens, pos, bindPoints, boundaryIds, "element");
      children = inner.ops;
      pos = inner.pos;
      if (tokens[pos]?.kind === "close") pos++;
    }
    ops.push({ kind: "element", tag, attrs, children });
  }
  if (stop === "each") throw parseError("missing {/each}");
  return { ops, pos };
}

function parseAttrs(attrStr: string, bindPoints: BindPoint[]): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:@-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\{[^}]+\})))?/g;
  for (const m of attrStr.matchAll(re)) {
    const name = m[1]!;
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (name.startsWith("on:") && value.startsWith("{")) {
      const handler = value.slice(1, -1).trim();
      attrs[name] = handler;
      bindPoints.push({ id: handler, kind: "click", expr: handler });
      continue;
    }
    attrs[name] = value;
  }
  return attrs;
}

function parseError(message: string): LuxelCompileError {
  return new LuxelCompileError([{ code: "LUXEL_TEMPLATE_PARSE", message }]);
}
