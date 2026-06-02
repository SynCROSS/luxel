const COMMENT_NODE = 8;
const ELEMENT_NODE = 1;

export function findBoundaryHostElement(root: ParentNode, boundaryId: string): HTMLElement | null {
  const startNeedle = `luxel:boundary-start id="${boundaryId}"`;
  const endNeedle = `luxel:boundary-end id="${boundaryId}"`;

  function walk(node: Node): HTMLElement | null {
    if (node.nodeType === COMMENT_NODE && (node.textContent ?? "").includes(startNeedle)) {
      let sibling: Node | null = node.nextSibling;
      while (sibling) {
        if (sibling.nodeType === COMMENT_NODE && (sibling.textContent ?? "").includes(endNeedle)) {
          return null;
        }
        if (sibling.nodeType === ELEMENT_NODE) {
          return sibling as HTMLElement;
        }
        sibling = sibling.nextSibling;
      }
      return null;
    }

    for (const child of node.childNodes) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }

  return walk(root);
}
