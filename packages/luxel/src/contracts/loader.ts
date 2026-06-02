import { readFileSync } from "node:fs";
import { join } from "node:path";
import manifestGolden from "../../test/fixtures/contracts/manifest.json";

const fixturesDir = join(import.meta.dir, "../../test/fixtures/contracts");
const ssrGolden = readFileSync(join(fixturesDir, "ssr.html"), "utf8");

export type ManifestContract = typeof manifestGolden;

export function loadManifestContract(): ManifestContract {
  return structuredClone(manifestGolden);
}

export function loadSsrContract(): string {
  return ssrGolden;
}

export function loadLuxelDataContract(): { message: string } {
  return { message: "Hello Luxel" };
}

export function loadLuxelHydrationContract() {
  return {
    routeId: "route:index",
    boundaries: [
      {
        id: "boundary:0",
        directive: "load",
        clientModule: "client/routes/index.js",
      },
    ],
  };
}
