/** Best-effort memory release between sequential stack runs (Bun worker churn). */
export function releaseBetweenStacks(): void {
  const bun = (globalThis as { Bun?: { gc?: (sync: boolean) => void } }).Bun;
  if (typeof bun?.gc === "function") {
    bun.gc(true);
  }
}
