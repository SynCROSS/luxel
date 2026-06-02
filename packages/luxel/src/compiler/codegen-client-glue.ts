export function codegenClientGlue(attachImportPath: string): string {
  return `
import { attach } from "${attachImportPath}";

export function setupBoundary(_ctx: { data: { message: string } }) {
  return {
    attach(root: HTMLElement) {
      attach(root, { count, increment });
    },
  };
}
`.trim();
}
