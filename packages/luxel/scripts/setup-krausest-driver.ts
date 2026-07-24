import { join } from "node:path";
import { setupKrausestDriver } from "../src/bench/krausest/setup-driver.ts";

const repoRoot = join(import.meta.dir, "../../..");

await setupKrausestDriver(repoRoot);
console.log("krausest driver ready (webdriver-ts/dist/benchmarkRunner.js)");
