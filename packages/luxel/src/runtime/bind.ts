import type { Signal } from "./signal.ts";
import type { Unsubscribe } from "./signal.ts";

export function bindText(el: Element | null, read: () => string): void {
  if (!el) throw new Error("bindText: element not found");
  el.textContent = read();
}

export function bindClick(el: Element | null, handler: () => void): void {
  if (!el) throw new Error("bindClick: element not found");
  el.addEventListener("click", handler);
}

export function bindTextSignal(el: Element | null, s: Signal<number>): Unsubscribe {
  if (!el) throw new Error("bindText: element not found");
  const update = () => {
    el.textContent = String(s.value);
  };
  update();
  return s.subscribe(update);
}
