/** True when `load` only warms constant resources (no session/request/IO). */
export function inferStaticLoad(script: string): boolean {
  if (!/\bexport\s+async\s+function\s+load\s*\(/.test(script)) return false;
  if (/\bctx\.session\b|\bctx\.request\b|\bheaders\b|\bcookies\b/.test(script)) return false;
  if (/\bfetch\s*\(/.test(script)) return false;
  if (/\bstore\.isStale\s*\(/.test(script)) return false;
  return true;
}
