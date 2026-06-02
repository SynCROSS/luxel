export type ParsedSfc = {
  template: string;
  script: string;
  style: string;
};

export function parseSfc(source: string): ParsedSfc {
  const template = extractBlock(source, "template");
  const script = extractBlock(source, "script");
  const style = extractBlock(source, "style");
  if (!template) throw new Error("SFC missing <template>");
  return { template, script, style };
}

function extractBlock(source: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = source.match(re);
  return m?.[1]?.trim() ?? "";
}
