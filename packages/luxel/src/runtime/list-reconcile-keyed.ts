export function reconcileKeyedList<T>(
  container: Element,
  items: readonly T[],
  keyFn: (item: T, index: number) => string | number,
  createRow: (item: T, index: number) => HTMLElement,
  updateRow: (row: HTMLElement, item: T, index: number) => void,
): void {
  const existingByKey = new Map<string, HTMLElement>();
  for (const child of container.children) {
    const key = child.getAttribute("data-luxel-key");
    if (key) existingByKey.set(key, child as HTMLElement);
  }

  const desiredKeys = items.map((item, index) => String(keyFn(item, index)));
  for (const [key, node] of existingByKey) {
    if (!desiredKeys.includes(key)) {
      container.removeChild(node);
      existingByKey.delete(key);
    }
  }

  for (let index = 0; index < items.length; index++) {
    const item = items[index]!;
    const key = desiredKeys[index]!;
    let row = existingByKey.get(key);
    if (!row) {
      row = createRow(item, index);
      row.setAttribute("data-luxel-key", key);
      existingByKey.set(key, row);
    } else {
      updateRow(row, item, index);
    }
    const current = container.children[index];
    if (current !== row) {
      container.insertBefore(row, container.children[index] ?? null);
    }
  }
}
