export function codegenServerModule(scriptBlock: string, renderFnName: string): string {
  return `${scriptBlock.trim()}

export async function render(ctx: { data: Awaited<ReturnType<typeof load>> }) {
  return ${renderFnName}(ctx.data);
}
`;
}
