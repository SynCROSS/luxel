import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { competitorSource } from "@luxel/luxel/bench";

export async function syncCounterSource(
  framework: "react" | "vue-vdom" | "vue-vapor" | "solid" | "svelte",
  destRoot: string,
): Promise<void> {
  await mkdir(join(destRoot, "src"), { recursive: true });
  if (framework === "react") {
    await copyFile(competitorSource("counter", "react.tsx"), join(destRoot, "src/App.tsx"));
    return;
  }
  if (framework === "solid") {
    await copyFile(competitorSource("counter", "solid.ts"), join(destRoot, "src/App.ts"));
    return;
  }
  if (framework === "svelte") {
    await copyFile(competitorSource("counter", "svelte.svelte"), join(destRoot, "src/App.svelte"));
    return;
  }
  const vueFile = framework === "vue-vapor" ? "vue-vapor.vue" : "vue-vdom.vue";
  await copyFile(competitorSource("counter", vueFile), join(destRoot, "src/App.vue"));
}
