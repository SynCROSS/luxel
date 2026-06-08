import { createSignal } from "solid-js";
import { ssr } from "solid-js/web";

export function CounterApp() {
  const [count] = createSignal(0);
  return ssr`<h1>Hello Luxel</h1><section><button type="button" data-luxel-text="count">${count()}</button></section>`;
}
