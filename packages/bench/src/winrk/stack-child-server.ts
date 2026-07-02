#!/usr/bin/env bun
/** Child process: start one stack, print BENCH_READY <url>, stay alive until SIGTERM. */
import "./apply-bench-host-env.ts";
import { allWinrkStacks } from "./registry.ts";

const stackId = process.argv[2];
if (!stackId) {
  console.error("usage: bun run src/winrk/stack-child-server.ts <stack-id>");
  process.exit(1);
}

const row = allWinrkStacks().find((s) => s.id === stackId);
if (!row) {
  console.error(`unknown stack: ${stackId}`);
  process.exit(1);
}

const server = await row.start();
if (!server) {
  console.error(`stack unavailable: ${row.pendingReason ?? "start returned null"}`);
  process.exit(1);
}

const probe = await fetch(server.url);
if (!probe.ok) {
  console.error(`probe failed: ${probe.status}`);
  await server.close();
  process.exit(1);
}

console.error(`BENCH_READY ${server.url}`);

const shutdown = async () => {
  await server.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
process.stdin.on("end", () => void shutdown());
process.stdin.resume();
await new Promise(() => {});
