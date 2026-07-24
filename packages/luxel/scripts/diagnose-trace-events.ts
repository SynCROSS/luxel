/** Dump event types from a krausest trace JSON. */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const submodule = join(import.meta.dir, "../../../vendor/js-framework-benchmark");
const name = process.argv[2] ?? "alins-v0.0.34-non-keyed_01_run1k_0.json";
const path = join(submodule, "webdriver-ts/traces", name);
if (!existsSync(path)) {
  console.error(`missing ${path}`);
  process.exit(2);
}
const raw = JSON.parse(readFileSync(path, "utf8")) as {
  traceEvents?: Array<{ name?: string; ph?: string; cat?: string; pid?: number; ts?: number }>;
};
const events = raw.traceEvents ?? [];
const names = new Map<string, number>();
for (const e of events) {
  const key = `${e.name ?? "?"} ph=${e.ph ?? "?"}`;
  names.set(key, (names.get(key) ?? 0) + 1);
}
const commits = events.filter((e) => /commit/i.test(e.name ?? ""));
const clicks = events.filter((e) => /click|EventDispatch/i.test(e.name ?? ""));
console.error(
  JSON.stringify(
    {
      file: name,
      total: events.length,
      commitLike: commits.map((e) => e.name).slice(0, 20),
      commitCount: commits.length,
      clickLike: [...new Set(clicks.map((e) => e.name))].slice(0, 20),
      topNames: [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30),
    },
    null,
    2,
  ),
);
