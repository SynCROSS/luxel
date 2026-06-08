import type { CodegenSsrOptions } from "./codegen-ssr.ts";
import type { RenderIr } from "./render-ir.ts";
import type { TemplateBinding } from "../resource-store/luxel-data.ts";
import type { LuxelDataV2 } from "../resource-store/luxel-data.ts";

export type PrecomputedRender = {
  html: string;
  data: LuxelDataV2;
};

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

const RENDER_IMPORTS = [
  `import { codegenSsrDocument } from "../../../../compiler/codegen-ssr.ts";`,
  `import { projectSnapshotToTemplateData } from "../../../../resource-store/project-bindings.ts";`,
  `import type { ResourceStore } from "../../../../resource-store/store.ts";`,
  `import type { RenderIr } from "../../../../compiler/render-ir.ts";`,
  `import type { ResourceSnapshot } from "../../../../resource-store/types.ts";`,
].join("\n");

export function codegenDynamicRenderModule(
  renderIr: RenderIr,
  codegenOpts: CodegenSsrOptions,
  bindings: TemplateBinding[],
): string {
  const ssrOptsJson = JSON.stringify(codegenOpts);
  const bindingsJson = JSON.stringify(bindings);
  return [
    RENDER_IMPORTS,
    ``,
    `const renderIr = ${JSON.stringify(renderIr)} as RenderIr;`,
    `const codegenOpts = ${ssrOptsJson} as const;`,
    `const BINDING_MAP = ${bindingsJson} as const;`,
    ``,
    `export function renderRouteDocumentFromStore(store: ResourceStore): string {`,
    `  const snapshot = store.snapshot();`,
    `  const templateData = projectSnapshotToTemplateData(snapshot, BINDING_MAP);`,
    `  return codegenSsrDocument(renderIr, templateData, snapshot, codegenOpts, BINDING_MAP);`,
    `}`,
  ].join("\n");
}

export function codegenPrecomputedWithFallbackModule(
  renderIr: RenderIr,
  codegenOpts: CodegenSsrOptions,
  bindings: TemplateBinding[],
  precomputed: PrecomputedRender,
): string {
  const ssrOptsJson = JSON.stringify(codegenOpts);
  const bindingsJson = JSON.stringify(bindings);
  return [
    RENDER_IMPORTS,
    ``,
    `const renderIr = ${JSON.stringify(renderIr)} as RenderIr;`,
    `const codegenOpts = ${ssrOptsJson} as const;`,
    `const BINDING_MAP = ${bindingsJson} as const;`,
    `const PRECOMPUTED_HTML = ${JSON.stringify(precomputed.html)};`,
    `const PRECOMPUTED_RESOURCES: ResourceSnapshot = ${JSON.stringify(precomputed.data.resources)};`,
    ``,
    SNAPSHOT_EQUAL_FN,
    ``,
    `export function renderRouteDocumentFromStore(store: ResourceStore): string {`,
    `  const snapshot = store.snapshot();`,
    `  if (resourceSnapshotsEqual(snapshot, PRECOMPUTED_RESOURCES)) {`,
    `    return PRECOMPUTED_HTML;`,
    `  }`,
    `  const templateData = projectSnapshotToTemplateData(snapshot, BINDING_MAP);`,
    `  return codegenSsrDocument(renderIr, templateData, snapshot, codegenOpts, BINDING_MAP);`,
    `}`,
  ].join("\n");
}

export function codegenServerModuleSrc(
  script: string,
  renderModuleSrc: string,
  hasClientBundle: boolean,
): string {
  const serverImports = hasClientBundle
    ? `import { signal } from "../../../../runtime/signal.ts";\n`
    : "";
  return [serverImports, script.trim(), ``, renderModuleSrc, ``].join("\n");
}
