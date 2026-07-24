import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = process.argv[2] ?? "alins-v0.0.34-non-keyed_01_run1k_0.json";
const path = join(import.meta.dir, "../../../vendor/js-framework-benchmark/webdriver-ts/traces", file);
const raw = JSON.parse(readFileSync(path, "utf8")) as {
  traceEvents: Array<{
    name?: string;
    ph?: string;
    pid?: number;
    tid?: number;
    ts?: number;
    dur?: number;
    args?: { data?: { type?: string } };
  }>;
};

const commits = raw.traceEvents.filter((e) => e.name === "Commit");
const clicks = raw.traceEvents.filter(
  (e) => e.name === "EventDispatch" && e.args?.data?.type === "click",
);
const layouts = raw.traceEvents.filter((e) => e.name === "Layout" && e.ph === "X");

console.error(
  JSON.stringify(
    {
      file,
      commits: commits.map((e) => ({
        ph: e.ph,
        pid: e.pid,
        tid: e.tid,
        ts: e.ts,
        dur: e.dur,
        end: (e.ts ?? 0) + (e.dur ?? 0),
      })),
      clicks: clicks.map((e) => ({
        ph: e.ph,
        pid: e.pid,
        tid: e.tid,
        ts: e.ts,
        dur: e.dur,
        end: (e.ts ?? 0) + (e.dur ?? 0),
      })),
      layoutCount: layouts.length,
      layoutPids: [...new Set(layouts.map((e) => e.pid))],
      commitPids: [...new Set(commits.map((e) => e.pid))],
      clickPids: [...new Set(clicks.map((e) => e.pid))],
    },
    null,
    2,
  ),
);
