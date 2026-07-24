import type { Signal } from "./signal.ts";
import type { Unsubscribe } from "./signal.ts";

export function bindText(el: Element | null, read: () => string): void {
  if (!el) throw new Error("bindText: element not found");
  el.textContent = read();
}

export type ClickHandler = (event: MouseEvent) => void;

export function bindClick(el: Element | null, handler: ClickHandler): void {
  if (!el) throw new Error("bindClick: element not found");
  el.addEventListener("click", handler);
}

/**
 * One listener on `root` for `[data-luxel-click]` descendants.
 * Used by `{#each}` row templates so cloneNode rows need no per-row listeners.
 */
export function bindDelegatedClicks(
  root: Element | null,
  dispatch: (name: string, event: MouseEvent) => void,
): void {
  if (!root) throw new Error("bindDelegatedClicks: element not found");
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!isElementNode(target)) return;
    let el: Element | null = target;
    while (el && el !== root) {
      const name = el.getAttribute("data-luxel-click");
      if (name) {
        dispatch(name, event as MouseEvent);
        return;
      }
      el = el.parentElement;
    }
  });
}

function isElementNode(node: unknown): node is Element {
  return (
    typeof node === "object" &&
    node !== null &&
    "getAttribute" in node &&
    typeof (node as Element).getAttribute === "function"
  );
}

export function queryLuxelAttr(root: ParentNode, attr: string, value: string): Element[] {
  const out: Element[] = [];
  const visit = (node: Element): void => {
    if (node.getAttribute(attr) === value) out.push(node);
    for (const child of node.children) visit(child);
  };
  if (isElementNode(root)) visit(root);
  else {
    for (const child of root.childNodes) {
      if (isElementNode(child)) visit(child);
    }
  }
  return out;
}

export function queryLuxelAttrFirst(root: ParentNode, attr: string, value: string): Element | null {
  return queryLuxelAttr(root, attr, value)[0] ?? null;
}

export function bindTextSignal(el: Element | null, s: Signal<number>): Unsubscribe {
  if (!el) throw new Error("bindText: element not found");
  const update = () => {
    el.textContent = String(s.value);
  };
  update();
  return s.subscribe(update);
}
