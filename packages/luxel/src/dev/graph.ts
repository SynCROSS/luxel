export type GraphNode = {
  id: string;
  deps: string[];
};

export class DevGraph {
  private nodes = new Map<string, GraphNode>();

  add(id: string, deps: string[] = []) {
    this.nodes.set(id, { id, deps });
  }

  invalidate(changedId: string): Set<string> {
    const out = new Set<string>();
    for (const node of this.nodes.values()) {
      if (node.id === changedId || node.deps.includes(changedId)) {
        out.add(node.id);
      }
    }
    return out;
  }
}
