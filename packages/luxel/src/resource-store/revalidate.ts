import type { ResourceStore } from "./store.ts";

/** Server-only API: invalidate all store entries with the given tag. */
export function revalidateTag(store: ResourceStore, tag: string): void {
  store.revalidateTag(tag);
}
