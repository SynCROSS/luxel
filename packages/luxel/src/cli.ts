#!/usr/bin/env bun
import { createHostContext, dispatchHostCommand } from "./host/host-runtime.ts";

const cmd = process.argv[2];
const cwd = process.cwd();
const ctx = createHostContext(cwd);

async function main() {
  const { code, result } = await dispatchHostCommand(cmd, process.argv.slice(3), ctx);
  if (result === "hang") {
    await new Promise(() => {});
    return;
  }
  if (code !== 0) {
    process.exit(code);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
