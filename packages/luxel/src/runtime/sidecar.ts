export function readJsonSidecar<T>(id: string, root: Document | ParentNode = document): T {
  const el =
    "getElementById" in root && typeof root.getElementById === "function"
      ? root.getElementById(id)
      : root.querySelector(`[id="${id}"]`);
  if (!el) throw new Error(`sidecar #${id} not found`);
  const text = el.textContent?.trim();
  if (!text) throw new Error(`sidecar #${id} empty`);
  return JSON.parse(text) as T;
}
