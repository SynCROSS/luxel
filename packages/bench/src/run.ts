import { runBenchRegistry } from "@luxel/luxel";

for await (const line of runBenchRegistry()) {
  console.log(JSON.stringify(line));
}
