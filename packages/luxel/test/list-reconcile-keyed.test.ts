import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { reconcileKeyedList } from "../src/runtime/list-reconcile-keyed.ts";

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

describe("reconcileKeyedList", () => {
  test("preserves DOM nodes when keyed rows reorder", () => {
    withDom((document) => {
      const tbody = document.createElement("tbody");
      const create = (item: { id: number; label: string }) => {
        const tr = document.createElement("tr");
        tr.textContent = item.label;
        return tr;
      };
      const update = (tr: HTMLElement, item: { id: number; label: string }) => {
        tr.textContent = item.label;
      };
      reconcileKeyedList(
        tbody,
        [
          { id: 1, label: "a" },
          { id: 2, label: "b" },
        ],
        (item) => item.id,
        create,
        update,
      );
      const first = tbody.children[0];
      const second = tbody.children[1];
      reconcileKeyedList(
        tbody,
        [
          { id: 2, label: "b2" },
          { id: 1, label: "a2" },
        ],
        (item) => item.id,
        create,
        update,
      );
      expect(tbody.children.length).toBe(2);
      expect(tbody.children[0]).toBe(second);
      expect(tbody.children[1]).toBe(first);
      expect(tbody.children[0]?.textContent).toBe("b2");
      expect(tbody.children[1]?.textContent).toBe("a2");
    });
  });

  test("removes keyed rows that disappear from the list", () => {
    withDom((document) => {
      const tbody = document.createElement("tbody");
      const create = (item: { id: number; label: string }) => {
        const tr = document.createElement("tr");
        tr.textContent = item.label;
        return tr;
      };
      const update = (tr: HTMLElement, item: { id: number; label: string }) => {
        tr.textContent = item.label;
      };
      reconcileKeyedList(
        tbody,
        [
          { id: 1, label: "a" },
          { id: 2, label: "b" },
        ],
        (item) => item.id,
        create,
        update,
      );
      reconcileKeyedList(tbody, [{ id: 2, label: "b" }], (item) => item.id, create, update);
      expect(tbody.children.length).toBe(1);
      expect(tbody.children[0]?.textContent).toBe("b");
    });
  });
});
