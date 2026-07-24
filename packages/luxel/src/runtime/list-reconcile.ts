/** Last item reference bound to a row element — skip updateRow when unchanged. */
const rowItemRef = new WeakMap<Element, unknown>();

export function reconcileNonKeyedList<T>(
  container: Element,
  items: readonly T[],
  createRow: (item: T, index: number) => HTMLElement,
  updateRow: (row: HTMLElement, item: T, index: number) => void,
): void {
  const existing = container.children;
  if (items.length === 0) {
    // textContent clear is cheaper than replaceChildren for large tables (krausest clear).
    if (existing.length > 0) (container as HTMLElement).textContent = "";
    return;
  }

  // Same length: single-pass in-place updates. Prefer this over all-dirty recreate
  // once row createFill is id+label text only — recreate still sits on ~200ms layout floor.
  // Note: 2-row DOM-swap fast path rejected — distant table moves inflate traces.
  if (existing.length === items.length) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const row = existing[i] as HTMLElement;
      if (rowItemRef.get(row) === item) continue;
      updateRow(row, item, i);
      rowItemRef.set(row, item);
    }
    return;
  }

  const shared = Math.min(items.length, existing.length);
  for (let i = 0; i < shared; i++) {
    const row = existing[i] as HTMLElement;
    const item = items[i]!;
    if (rowItemRef.get(row) === item) continue;
    updateRow(row, item, i);
    rowItemRef.set(row, item);
  }
  while (existing.length > items.length) {
    container.removeChild(existing[existing.length - 1]!);
  }
  const appendFrom = existing.length;
  if (appendFrom < items.length) {
    const pending = items.length - appendFrom;
    if (pending > 1) {
      const fragment = document.createDocumentFragment();
      for (let i = appendFrom; i < items.length; i++) {
        const item = items[i]!;
        const row = createRow(item, i);
        rowItemRef.set(row, item);
        fragment.appendChild(row);
      }
      container.appendChild(fragment);
    } else {
      const item = items[appendFrom]!;
      const row = createRow(item, appendFrom);
      rowItemRef.set(row, item);
      container.appendChild(row);
    }
  }
}
