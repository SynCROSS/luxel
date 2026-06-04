import type { LoadContext } from "../resource-store/load-context.ts";
import type { Manifest } from "../manifest/types.ts";

export type AppRoute = {
  path: string;
  routeId: string;
  load: (ctx: LoadContext) => Promise<Record<string, unknown>>;
  renderDocument: (data: Record<string, unknown>) => string;
  renderStream: (data: Record<string, unknown>) => ReadableStream<Uint8Array>;
};

export type AppRuntime = {
  manifest: Manifest;
  getRoute: (path: string) => AppRoute | undefined;
};
