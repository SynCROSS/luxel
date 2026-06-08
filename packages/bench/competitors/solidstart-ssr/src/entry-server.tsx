import { createHandler, StartServer } from "@solidjs/start/server";

function Document(props: { assets: unknown; scripts: unknown; children: unknown }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Luxel</title>
        {props.assets}
      </head>
      <body>
        <main id="app">{props.children}</main>
        {props.scripts}
      </body>
    </html>
  );
}

export default createHandler(() => <StartServer document={Document} />);