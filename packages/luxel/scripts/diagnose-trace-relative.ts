import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = process.argv[2] ?? "alins-v0.0.34-non-keyed_01_run1k_0.json";
const path = join(import.meta.dir, "../../../vendor/js-framework-benchmark/webdriver-ts/traces", file);
const raw = JSON.parse(readFileSync(path, "utf8")) as {
  traceEvents: Array<{
    name?: string;
    ph?: string;
    pid?: number;
    ts?: number;
    dur?: number;
    args?: { data?: { type?: string } };
  }>;
};

const click = raw.traceEvents.find(
  (e) => e.name === "EventDispatch" && e.args?.data?.type === "click",
);
if (!click) {
  console.error("no click");
  process.exit(2);
}
const clickStart = click.ts!;
const clickEnd = click.ts! + (click.dur ?? 0);

const interesting = raw.traceEvents
  .filter((e) =>
    ["Commit", "Layout", "Paint", "PrePaint", "UpdateLayerTree", "ScheduleStyleRecalculation"].includes(
      e.name ?? "",
    ),
  )
  .map((e) => ({
    name: e.name,
    ph: e.ph,
    relStartMs: ((e.ts ?? 0) - clickStart) / 1000,
    relEndMs: ((e.ts ?? 0) + (e.dur ?? 0) - clickStart) / 1000,
    afterClickEnd: (e.ts ?? 0) > clickEnd,
  }));

console.error(
  JSON.stringify(
    {
      file,
      clickDurMs: (click.dur ?? 0) / 1000,
      events: interesting,
    },
    null,
    2,
  ),
);
