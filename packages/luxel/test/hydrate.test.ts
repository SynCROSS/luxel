import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { findBoundaryHostElement } from "../src/runtime/boundary-host.ts";
import { hydrateRoute } from "../src/runtime/hydrate.ts";
import type { BoundaryModule } from "../src/runtime/hydrate-types.ts";

function withDom(run: (document: Document) => void): void {
  const window = new Window();
  const doc = window.document;
  (globalThis as { document?: Document }).document = doc;
  try {
    run(doc);
  } finally {
    delete (globalThis as { document?: Document }).document;
  }
}

describe("boundary host resolution", () => {
  test("finds element between luxel boundary comment markers", () => {
    withDom((document) => {
      document.body.innerHTML = `
        <main>
          <h1>Hello</h1>
          <!-- luxel:boundary-start id="boundary:0" directive="load" -->
          <section><button type="button">0</button></section>
          <!-- luxel:boundary-end id="boundary:0" -->
        </main>
      `;

      const host = findBoundaryHostElement(document.body, "boundary:0");
      expect(host?.tagName).toBe("SECTION");
    });
  });
});

describe("hydrateRoute", () => {
  test("attaches using boundary host from hydration metadata", () => {
    withDom((document) => {
      document.body.innerHTML = `
        <main data-luxel-route="/">
          <h1>Hello Luxel</h1>
          <!-- luxel:boundary-start id="boundary:0" directive="load" -->
          <section><button type="button" data-luxel-text="count">0</button></section>
          <!-- luxel:boundary-end id="boundary:0" -->
        </main>
      `;

      let attachTarget: HTMLElement | null = null;
      const routeModule: BoundaryModule = {
        setupBoundary: () => ({
          attach(root: HTMLElement) {
            attachTarget = root;
          },
        }),
      };

      hydrateRoute({
        routeId: "route:index",
        data: { message: "Hello Luxel" },
        boundaries: [
          { id: "boundary:0", directive: "load", clientModule: "client/routes/index.js" },
        ],
        modules: { "route:index": routeModule },
      });

      expect(attachTarget?.tagName).toBe("SECTION");
    });
  });

  test("throws when luxel-hydration references a missing boundary host", () => {
    withDom((document) => {
      document.body.innerHTML = `<main></main>`;
      const routeModule: BoundaryModule = {
        setupBoundary: () => ({ attach() {} }),
      };

      expect(() =>
        hydrateRoute({
          routeId: "route:index",
          data: {},
          boundaries: [{ id: "boundary:0", directive: "load", clientModule: "x" }],
          modules: { "route:index": routeModule },
        }),
      ).toThrow(/boundary host not found/);
    });
  });
});
