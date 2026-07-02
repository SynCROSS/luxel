import { readFileSync } from "node:fs";
import {
  assertNativeDefaultReleaseReady,
  parseNativeDefaultGateFromJsonl,
} from "../src/bench/native-default-gate.ts";

const logPath = process.argv[2];
if (!logPath) {
  console.error("usage: bun verify-native-default-gate.ts <bench-log>");
  process.exit(2);
}

const text = readFileSync(logPath, "utf8");
const gate = parseNativeDefaultGateFromJsonl(text);
if (!gate) {
  console.error("native_default_gate line not found in bench log");
  process.exit(1);
}

try {
  assertNativeDefaultReleaseReady(gate);
  console.log("native default release-ready: auto_default_enabled=true");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
