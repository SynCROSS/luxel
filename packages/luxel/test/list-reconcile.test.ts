import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { reconcileNonKeyedList } from "../src/runtime/list-reconcile.ts";

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

describe("reconcileNonKeyedList", () => {
  test("creates rows when list grows", () => {
    withDom((document) => {
      const tbody = document.createElement("tbody");
      reconcileNonKeyedList(
        tbody,
        [{ label: "a" }, { label: "b" }],
        (item) => {
          const tr = document.createElement("tr");
          const td = document.createElement("td");
          td.textContent = item.label;
          tr.appendChild(td);
          return tr;
        },
        (tr, item) => {
          (tr.firstChild as HTMLElement).textContent = item.label;
        },
      );
      expect(tbody.children.length).toBe(2);
      expect(tbody.children[0]?.textContent).toBe("a");
      expect(tbody.children[1]?.textContent).toBe("b");
    });
  });

  test("updates rows in place when length unchanged", () => {
    withDom((document) => {
      const tbody = document.createElement("tbody");
      const create = (item: { label: string }) => {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.textContent = item.label;
        tr.appendChild(td);
        return tr;
      };
      const update = (tr: HTMLElement, item: { label: string }) => {
        (tr.firstChild as HTMLElement).textContent = item.label;
      };
      reconcileNonKeyedList(tbody, [{ label: "a" }], create, update);
      const first = tbody.children[0];
      reconcileNonKeyedList(tbody, [{ label: "b" }], create, update);
      expect(tbody.children.length).toBe(1);
      expect(tbody.children[0]).toBe(first);
      expect(tbody.children[0]?.textContent).toBe("b");
    });
  });

  test("removes trailing rows when list shrinks", () => {
    withDom((document) => {
      const tbody = document.createElement("tbody");
      const create = (item: { label: string }) => {
        const tr = document.createElement("tr");
        tr.textContent = item.label;
        return tr;
      };
      const update = (tr: HTMLElement, item: { label: string }) => {
        tr.textContent = item.label;
      };
      reconcileNonKeyedList(
        tbody,
        [{ label: "a" }, { label: "b" }, { label: "c" }],
        create,
        update,
      );
      reconcileNonKeyedList(tbody, [{ label: "x" }], create, update);
      expect(tbody.children.length).toBe(1);
      expect(tbody.children[0]?.textContent).toBe("x");
    });
  });
});
