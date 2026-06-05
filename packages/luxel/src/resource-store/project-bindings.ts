import type { ResourceStore } from "./store.ts";
import { projectFromSnapshot, type TemplateBinding } from "./luxel-data.ts";

export function projectStoreToTemplateData(
  store: ResourceStore,
  bindings: readonly TemplateBinding[],
): Record<string, unknown> {
  return projectFromSnapshot(store.snapshot(), bindings);
}

export function projectSnapshotToTemplateData(
  snapshot: import("./types.ts").ResourceSnapshot,
  bindings: readonly TemplateBinding[],
): Record<string, unknown> {
  return projectFromSnapshot(snapshot, bindings);
}
