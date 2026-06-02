import { bindClick, bindTextSignal } from "../../runtime/bind.ts";
import type { Signal } from "../../runtime/signal.ts";

export function attach(
  root: HTMLElement,
  ctx: { count: Signal<number>; increment: () => void },
): void {
  const button = root.querySelector('[data-luxel-text="count"]');
  bindTextSignal(button, ctx.count);
  bindClick(button, ctx.increment);
}
