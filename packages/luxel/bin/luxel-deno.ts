#!/usr/bin/env -S deno run --allow-read --allow-env --allow-write --allow-net --allow-run --allow-sys
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runNativeHost } from "../src/host/native-host.ts";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const code = await runNativeHost("deno", Deno.args, Deno.cwd(), {
  pkgSrc: join(pkgRoot, "src"),
});
Deno.exit(code);
