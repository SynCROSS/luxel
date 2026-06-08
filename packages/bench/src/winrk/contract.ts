/** Shared counter DOM contract — see docs/benchmarks/fairness.md */
export const COUNTER_HEADLINE = "Hello Luxel";

export const COUNTER_COUNTER_MARKUP =
  `<h1>${COUNTER_HEADLINE}</h1>` +
  `<section><button type="button" data-luxel-text="count">0</button></section>`;

export function counterDocumentFromBody(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel</title></head><body><main>${body}</main></body></html>`;
}

export const COUNTER_CSR_SHELL = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Luxel</title></head><body><main id="app"></main><script type="module" src="/assets/index.js"></script></body></html>`;
