export function codegenClientGlue(attachImportPath: string, handlerSymbols: string[]): string {
  const ctxArgs = handlerSymbols.join(", ");
  return `
import { attach } from "${attachImportPath}";

export function setupBoundary(_ctx: { data: Record<string, unknown> }) {
  return {
    attach(root: HTMLElement) {
      attach(root, { ${ctxArgs} });
    },
  };
}
`.trim();
}
