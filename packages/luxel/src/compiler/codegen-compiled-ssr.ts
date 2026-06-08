import type { CodegenSsrOptions } from "./codegen-ssr.ts";
import { codegenSsrDocumentFromBody } from "./codegen-ssr.ts";
import type { DomOp } from "./dom-op.ts";
import type { RenderIr } from "./render-ir.ts";
import type { TemplateBinding } from "../resource-store/luxel-data.ts";
import type { LuxelDataV2 } from "../resource-store/luxel-data.ts";

type PrecomputedRender = {
  html: string;
  data: LuxelDataV2;
};
import { classifyExpr, type TemplateExpr } from "./semantic-ir.ts";

const RENDER_IMPORTS = [
  `import { codegenSsrDocumentFromBody } from "../../../../compiler/codegen-ssr.ts";`,
  `import { escapeHtml } from "../../../../html/escape.ts";`,
  `import { projectSnapshotToTemplateData } from "../../../../resource-store/project-bindings.ts";`,
  `import type { ResourceStore } from "../../../../resource-store/store.ts";`,
  `import type { ResourceSnapshot } from "../../../../resource-store/types.ts";`,
].join("\n");

const SNAPSHOT_EQUAL_FN = [
  `function resourceSnapshotsEqual(a: ResourceSnapshot, b: ResourceSnapshot): boolean {`,
  `  const aKeys = Object.keys(a).sort();`,
  `  const bKeys = Object.keys(b).sort();`,
  `  if (aKeys.length !== bKeys.length) return false;`,
  `  for (let i = 0; i < aKeys.length; i++) {`,
  `    if (aKeys[i] !== bKeys[i]) return false;`,
  `    const left = a[aKeys[i]!]!;`,
  `    const right = b[bKeys[i]!]!;`,
  `    if (left.generation !== right.generation) return false;`,
  `    if (JSON.stringify(left.value) !== JSON.stringify(right.value)) return false;`,
  `  }`,
  `  return true;`,
  `}`,
].join("\n");

type LoopCtx = { itemName: string };

export function renderIrHasForLoop(ops: readonly DomOp[]): boolean {
  for (const op of ops) {
    if (op.kind === "forLoop") return true;
    if (op.kind === "element" && renderIrHasForLoop(op.children)) return true;
  }
  return false;
}

export function codegenCompiledRenderModule(
  renderIr: RenderIr,
  codegenOpts: CodegenSsrOptions,
  bindings: TemplateBinding[],
): string {
  const bodyLines = emitBodyStatements(renderIr.domOps, "templateData", undefined, "  ");
  return renderModuleShell(renderIr, codegenOpts, bindings, bodyLines, null);
}

export function codegenPrecomputedWithFallbackCompiledModule(
  renderIr: RenderIr,
  codegenOpts: CodegenSsrOptions,
  bindings: TemplateBinding[],
  precomputed: PrecomputedRender,
): string {
  const bodyLines = emitBodyStatements(renderIr.domOps, "templateData", undefined, "  ");
  return renderModuleShell(renderIr, codegenOpts, bindings, bodyLines, precomputed);
}

function renderModuleShell(
  renderIr: RenderIr,
  codegenOpts: CodegenSsrOptions,
  bindings: TemplateBinding[],
  bodyLines: string[],
  precomputed: PrecomputedRender | null,
): string {
  const ssrOptsJson = JSON.stringify(codegenOpts);
  const bindingsJson = JSON.stringify(bindings);
  const precomputedBlock = precomputed
    ? [
        `const PRECOMPUTED_HTML = ${JSON.stringify(precomputed.html)};`,
        `const PRECOMPUTED_RESOURCES: ResourceSnapshot = ${JSON.stringify(precomputed.data.resources)};`,
        ``,
        SNAPSHOT_EQUAL_FN,
        ``,
      ]
    : [];

  const precomputedGuard = precomputed
    ? [
        `  if (resourceSnapshotsEqual(snapshot, PRECOMPUTED_RESOURCES)) {`,
        `    return PRECOMPUTED_HTML;`,
        `  }`,
      ]
    : [];

  const boundaryIdsJson = JSON.stringify(renderIr.boundaryIds);
  const headStyleJson = JSON.stringify(renderIr.headStyle);

  return [
    RENDER_IMPORTS,
    ``,
    `const codegenOpts = ${ssrOptsJson} as const;`,
    `const BINDING_MAP = ${bindingsJson} as const;`,
    ...precomputedBlock,
    `export function renderRouteDocumentFromStore(store: ResourceStore): string {`,
    `  const snapshot = store.snapshot();`,
    ...precomputedGuard,
    `  const templateData = projectSnapshotToTemplateData(snapshot, BINDING_MAP);`,
    `  let body = "";`,
    ...bodyLines,
    `  return codegenSsrDocumentFromBody(body, snapshot, codegenOpts, BINDING_MAP, ${boundaryIdsJson}, ${headStyleJson});`,
    `}`,
  ].join("\n");
}

function emitBodyStatements(
  ops: readonly DomOp[],
  dataVar: string,
  loop: LoopCtx | undefined,
  indent: string,
): string[] {
  const lines: string[] = [];
  for (const op of ops) {
    if (op.kind === "text") {
      const js = jsForExpr(op.expr, dataVar, loop);
      lines.push(`${indent}body += escapeHtml(String(${js}));`);
      continue;
    }
    if (op.kind === "forLoop") {
      lines.push(`${indent}const _list = ${dataVar}.${op.listId};`);
      lines.push(`${indent}if (Array.isArray(_list)) {`);
      lines.push(`${indent}  for (let _i = 0; _i < _list.length; _i++) {`);
      lines.push(`${indent}    const ${op.itemName} = _list[_i];`);
      lines.push(
        ...emitBodyStatements(op.body, dataVar, { itemName: op.itemName }, `${indent}    `),
      );
      lines.push(`${indent}  }`);
      lines.push(`${indent}}`);
      continue;
    }
    if (op.kind === "element") {
      const openTag = emitOpenTagExpr(op.tag, op.attrs, dataVar, loop);
      if (op.children.length === 0) {
        lines.push(
          `${indent}body += ${openTag} + ${JSON.stringify(`></${op.tag}>`)};`,
        );
        continue;
      }
      lines.push(`${indent}body += ${openTag} + ">";`);
      lines.push(...emitBodyStatements(op.children, dataVar, loop, indent));
      lines.push(`${indent}body += ${JSON.stringify(`</${op.tag}>`)};`);
    }
  }
  return lines;
}

function emitOpenTagExpr(
  tag: string,
  attrs: Record<string, string>,
  dataVar: string,
  loop: LoopCtx | undefined,
): string {
  const attrExprs = Object.entries(attrs)
    .filter(([name]) => !name.startsWith("on:") && !name.startsWith("hydrate:"))
    .map(
      ([name, value]) =>
        ` + ' ${name}="' + ${emitAttrValueExpr(value, dataVar, loop)} + '"'`,
    );
  return `"<${tag}"${attrExprs.join("")}`;
}

function emitAttrValueExpr(value: string, dataVar: string, loop: LoopCtx | undefined): string {
  if (!value.includes("{")) {
    return JSON.stringify(value);
  }
  const parts: string[] = [];
  const re = /\{([^}]+)\}/g;
  let last = 0;
  for (const match of value.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push(JSON.stringify(value.slice(last, index)));
    }
    const raw = match[1]!.trim();
    const js = jsForExpr(classifyExpr(raw), dataVar, loop);
    if (raw.endsWith(".x") || raw.endsWith(".y")) {
      parts.push(`${js}.toFixed(2)`);
    } else {
      parts.push(`escapeHtml(String(${js}))`);
    }
    last = index + match[0].length;
  }
  if (last < value.length) {
    parts.push(JSON.stringify(value.slice(last)));
  }
  return parts.length === 1 ? parts[0]! : parts.join(" + ");
}

function jsForExpr(expr: TemplateExpr, dataVar: string, loop: LoopCtx | undefined): string {
  if (expr.kind === "literal") {
    return JSON.stringify(JSON.parse(expr.raw));
  }
  const raw = expr.raw;
  if (loop && (raw === loop.itemName || raw.startsWith(`${loop.itemName}.`))) {
    return raw;
  }
  if (raw.includes(".")) {
    return `${dataVar}.${raw}`;
  }
  return `${dataVar}.${raw}`;
}
