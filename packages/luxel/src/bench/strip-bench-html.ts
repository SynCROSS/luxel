/** Strip optional Luxel sidecars + client script for max-RPS bench rows (visible DOM unchanged). */
export function stripLuxelBenchSidecars(html: string): string {
  return html
    .replace(/\s*<script type="application\/json" id="luxel-data">[\s\S]*?<\/script>/g, "")
    .replace(/\s*<script type="application\/json" id="luxel-hydration">[\s\S]*?<\/script>/g, "")
    .replace(/\s*<script type="module" src="\/assets\/client\.dev0\.js"><\/script>/g, "")
    .replace(/\s*<script type="module" src="\/assets\/client\.[^"]+\.js"><\/script>/g, "");
}

export function isLuxelBenchMinimalHtml(): boolean {
  return (
    process.env.LUXEL_BENCH_MINIMAL_HTML === "1" || process.env.LUXEL_BENCH_MINIMAL_HTML === "true"
  );
}

/** Force per-request load + render — disable compile-time precompute fast paths. */
export function isLuxelBenchFullRender(): boolean {
  return (
    process.env.LUXEL_BENCH_FULL_RENDER === "1" || process.env.LUXEL_BENCH_FULL_RENDER === "true"
  );
}
