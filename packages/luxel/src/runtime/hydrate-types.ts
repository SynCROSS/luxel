export type BoundaryModule = {
  setupBoundary(ctx: { data: Record<string, unknown> }): {
    attach(root: HTMLElement): void;
  };
};
