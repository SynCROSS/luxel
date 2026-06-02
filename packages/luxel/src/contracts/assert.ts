export function assertManifestMatches(
  actual: unknown,
  expected: unknown,
): void {
  const a = JSON.stringify(actual, null, 2);
  const e = JSON.stringify(expected, null, 2);
  if (a !== e) {
    throw new Error(`Manifest mismatch:\n${diffHint(a, e)}`);
  }
}

export function assertSsrDocumentMatches(actualHtml: string, expectedHtml: string): void {
  const norm = (s: string) => s.replace(/\r\n/g, "\n").trim();
  const a = norm(actualHtml);
  const e = norm(expectedHtml);
  if (a !== e) {
    throw new Error("SSR document mismatch (normalized whitespace)");
  }
}

export function assertSsrContainsRequiredParts(html: string): void {
  if (!html.includes('id="luxel-data"')) throw new Error("missing luxel-data sidecar");
  if (!html.includes('id="luxel-hydration"')) throw new Error("missing luxel-hydration sidecar");
  if (!html.includes('type="application/json"')) throw new Error("missing JSON sidecar type");
  if (html.includes("unsafe:html")) throw new Error("unsafe:html must not appear");
  if (html.includes("luxel:boundary-start")) {
    if (!html.includes("luxel:boundary-end")) throw new Error("missing boundary end marker");
  }
}

function diffHint(a: string, e: string): string {
  if (a.length === e.length) return "content differs";
  return `expected length ${e.length}, got ${a.length}`;
}
