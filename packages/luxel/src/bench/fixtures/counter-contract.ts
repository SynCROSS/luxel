/**
 * Shared counter fixture contract for SSR bench rows.
 * Visible DOM must match across frameworks (screen parity).
 * See docs/benchmarks/fairness.md
 */
export const COUNTER_HEADLINE = "Hello Luxel";

/** Luxel counter route uses `<button data-luxel-text="count">`. */
export const COUNTER_COUNTER_MARKUP =
  `<h1>${COUNTER_HEADLINE}</h1>` +
  `<section><button type="button" data-luxel-text="count">0</button></section>`;

export function wrapCounterDocument(mainInnerHtml: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel</title></head><body><main>${mainInnerHtml}</main></body></html>`;
}

export function counterDocumentFromBody(body: string): string {
  return wrapCounterDocument(body);
}

export const COUNTER_MINIMAL_BODY = COUNTER_COUNTER_MARKUP;
