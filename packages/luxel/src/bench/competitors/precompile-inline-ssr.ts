import { competitorSource } from "./sources-path.ts";
import { compileReactTsxForSsr } from "./compile-react-tsx.ts";
import { compileVueSfcForSsr } from "./compile-vue-sfc.ts";
import { compileSvelteSfcForSsr } from "./compile-svelte-sfc.ts";
import { compileSolidTsForSsr } from "./compile-solid-ts.ts";
import type { SpiralInlineFramework } from "./spiral-inline-render.ts";

export type InlineSsrFixture = "counter" | "spiral";

/** Compile shared SSR artifacts once in parent — avoids worker-pool races on `.bench/competitors/*.mjs`. */
export async function precompileInlineSsr(
  fixture: InlineSsrFixture,
  framework: SpiralInlineFramework,
): Promise<void> {
  switch (framework) {
    case "react":
      await compileReactTsxForSsr(competitorSource(fixture, "react.tsx"), `${fixture}-react`);
      return;
    case "vue-vdom":
      await compileVueSfcForSsr(
        competitorSource(fixture, "vue-vdom.vue"),
        `${fixture}-vue-vdom`,
      );
      return;
    case "vue-vapor":
      await compileVueSfcForSsr(
        competitorSource(fixture, "vue-vapor.vue"),
        `${fixture}-vue-vapor`,
        true,
      );
      return;
    case "svelte":
      await compileSvelteSfcForSsr(
        competitorSource(fixture, "svelte.svelte"),
        fixture === "counter" ? "counter" : "spiral",
      );
      return;
    case "solid":
      await compileSolidTsForSsr(
        competitorSource(fixture, "solid.ts"),
        fixture === "counter" ? "counter-solid" : "spiral-solid",
      );
      return;
    default: {
      const _exhaustive: never = framework;
      return _exhaustive;
    }
  }
}
