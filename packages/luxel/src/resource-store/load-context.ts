import type { ResourceStore } from "./store.ts";

export type LoadContext = {
  store: ResourceStore;
  /** Server-only tag invalidation (phase 1). */
  revalidateTag: (tag: string) => void;
};

export function createLoadContext(store: ResourceStore): LoadContext {
  return {
    store,
    revalidateTag: (tag) => store.revalidateTag(tag),
  };
}
