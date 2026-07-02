export type RenderdRequest =
  | { op: "spiral-document"; routePath: string; headStyle: string }
  | { op: "shutdown" };

export type RenderdResponse =
  | { ok: true; html: string }
  | { ok: false; error: string };

export function encodeRenderdRequest(request: RenderdRequest): string {
  return `${JSON.stringify(request)}\n`;
}

export function parseRenderdResponse(line: string): RenderdResponse {
  return JSON.parse(line) as RenderdResponse;
}
