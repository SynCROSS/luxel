/**
 * Platformatic SSR showdown spiral — shared body contract for tier-2 benches.
 * @see docs/benchmarks/ssr-showdown.md
 */
import { spiralBodyMarkup, spiralTileCount } from "./spiral-html.ts";

export { spiralTileCount };

export const SPIRAL_BODY_MARKUP = spiralBodyMarkup();

export function spiralDocumentFromBody(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel spiral</title><style>
#wrapper{position:relative;width:960px;height:720px}
.tile{position:absolute;width:10px;height:10px;background:#333}
</style></head><body><main>${body}</main></body></html>`;
}

export function spiralMinimalDocument(): string {
  return spiralDocumentFromBody(SPIRAL_BODY_MARKUP);
}
