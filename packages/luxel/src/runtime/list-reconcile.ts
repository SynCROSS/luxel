export function reconcileNonKeyedList<T>(
  container: Element,
  items: readonly T[],
  createRow: (item: T, index: number) => HTMLElement,
  updateRow: (row: HTMLElement, item: T, index: number) => void,
): void {
  const existing = container.children;
  const shared = Math.min(items.length, existing.length);
  for (let i = 0; i < shared; i++) {
    updateRow(existing[i] as HTMLElement, items[i]!, i);
  }
  while (existing.length > items.length) {
    container.removeChild(existing[existing.length - 1]!);
  }
  for (let i = existing.length; i < items.length; i++) {
    container.appendChild(createRow(items[i]!, i));
  }
}
