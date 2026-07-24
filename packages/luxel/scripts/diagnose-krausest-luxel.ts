import { join } from "node:path";
import { runKrausestBenchCommand } from "../src/bench/krausest/cli.ts";

const repoRoot = join(import.meta.dir, "../../..");
const code = await runKrausestBenchCommand(repoRoot, {
  fullMatrix: false,
  allScenarios: true,
  gate: false,
  writeArtifacts: false,
});
process.exit(code);
