import type { ResourceStore } from "./store.ts";

export type LoadSession = {
  userId: string;
  csrfToken: string;
};

export type LoadContext = {
  store: ResourceStore;
  /** Server-only tag invalidation (phase 1). */
  revalidateTag: (tag: string) => void;
  /** Authenticated session when auth middleware enabled. */
  session: LoadSession | null;
};

export function createLoadContext(
  store: ResourceStore,
  session: LoadSession | null = null,
): LoadContext {
  return {
    store,
    revalidateTag: (tag) => store.revalidateTag(tag),
    session,
  };
}
