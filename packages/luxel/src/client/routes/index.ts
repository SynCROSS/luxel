import { signal } from "../../runtime/signal.ts";
import { attach } from "./index.attach.ts";

export function setupBoundary(_ctx: { data: { message: string } }) {
  const count = signal(0);
  return {
    attach(root: HTMLElement) {
      attach(root, {
        count,
        increment: () => {
          count.value++;
        },
      });
    },
  };
}
