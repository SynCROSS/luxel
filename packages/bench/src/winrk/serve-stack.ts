#!/usr/bin/env bun
/**
 * Start one benchmark stack and print its URL. Keep process alive for manual winrk.
 *
 *   bun run src/winrk/serve-stack.ts luxel-ssr
 *   winrk -t8 -c400 -d15 http://127.0.0.1:PORT
 */
import { allWinrkStacks } from "./registry.ts";

const STACKS = allWinrkStacks();

const id = process.argv[2];
if (!id) {
  console.error("usage: bun run src/winrk/serve-stack.ts <stack-id>");
  console.error("");
  console.error("stack ids:");
  for (const row of STACKS) {
    console.error(`  ${row.id}${row.pendingReason ? ` (may need: ${row.pendingReason})` : ""}`);
  }
  process.exit(0);
}

const row = STACKS.find((s) => s.id === id);
if (!row) {
  console.error(`unknown stack: ${id}`);
  process.exit(1);
}

const server = await row.start();
if (!server) {
  console.error(`stack ${id} not available: ${row.pendingReason ?? "start returned null"}`);
  process.exit(1);
}

const probe = await fetch(server.url);
if (!probe.ok) {
  console.error(`probe failed: ${probe.status}`);
  await server.close();
  process.exit(1);
}

console.log(`stack:   ${row.id}`);
console.log(`url:     ${server.url}`);
console.log(`winrk:   winrk -t8 -c400 -d15 ${server.url}`);
console.log("");
console.log("Ctrl+C to stop server");

const shutdown = async () => {
  await server.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
await new Promise(() => {});
