import { runNativeHost, type NativeHostOptions } from "./native-host.ts";

export async function runLuxelNode(
  args: string[],
  options?: NativeHostOptions,
): Promise<number> {
  return runNativeHost("node", args, process.cwd(), options);
}

if (import.meta.main) {
  process.exit(await runLuxelNode(process.argv.slice(2)));
}
