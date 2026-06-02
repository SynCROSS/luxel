import { escapeHtml } from "../html/escape.ts";

export const ASSET_CSS = "index.dev0.css";
export const ASSET_CLIENT = "client.dev0.js";

export type CounterLoadData = { message: string };

export async function load(): Promise<CounterLoadData> {
  return { message: "Hello Luxel" };
}

export function renderSsrDocument(data: CounterLoadData): string {
  const message = escapeHtml(data.message);
  const dataJson = JSON.stringify(data);
  const hydrationJson = JSON.stringify({
    routeId: "route:index",
    boundaries: [
      {
        id: "boundary:0",
        directive: "load",
        clientModule: "client/routes/index.js",
      },
    ],
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Luxel</title>
    <link rel="stylesheet" href="/assets/${ASSET_CSS}" />
  </head>
  <body>
    <main data-luxel-route="/">
      <h1>${message}</h1>
      <!-- luxel:boundary-start id="boundary:0" directive="load" -->
      <button type="button" data-luxel-text="count">0</button>
      <!-- luxel:boundary-end id="boundary:0" -->
    </main>

    <script type="application/json" id="luxel-data">
      ${dataJson}
    </script>
    <script type="application/json" id="luxel-hydration">
      ${hydrationJson}
    </script>
    <script type="module" src="/assets/${ASSET_CLIENT}"></script>
  </body>
</html>`;
}
