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

  test("updates rows in place when only some item refs change", () => {
    withDom((document) => {
      const tbody = document.createElement("tbody");
      const a = { label: "a" };
      const b = { label: "b" };
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
      reconcileNonKeyedList(tbody, [a, b], create, update);
      const first = tbody.children[0];
      const second = tbody.children[1];
      const b2 = { label: "b!" };
      reconcileNonKeyedList(tbody, [a, b2], create, update);
      expect(tbody.children.length).toBe(2);
      expect(tbody.children[0]).toBe(first);
      expect(tbody.children[1]).toBe(second);
      expect(tbody.children[1]?.textContent).toBe("b!");
    });
  });

  test("appends many rows when list grows from empty", () => {
    withDom((document) => {
      const tbody = document.createElement("tbody");
      const create = (item: { label: string }) => {
        const tr = document.createElement("tr");
        tr.textContent = item.label;
        return tr;
      };
      const update = () => {};
      const items = Array.from({ length: 50 }, (_, i) => ({ label: String(i) }));
      reconcileNonKeyedList(tbody, items, create, update);
      expect(tbody.children.length).toBe(50);
      expect(tbody.children[49]?.textContent).toBe("49");
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

  test("skips updateRow when item reference is unchanged", () => {
    withDom((document) => {
      const tbody = document.createElement("tbody");
      const a = { label: "a" };
      const b = { label: "b" };
      const c = { label: "c" };
      let updates = 0;
      const create = (item: { label: string }) => {
        const tr = document.createElement("tr");
        tr.textContent = item.label;
        return tr;
      };
      const update = (tr: HTMLElement, item: { label: string }) => {
        updates++;
        tr.textContent = item.label;
      };
      reconcileNonKeyedList(tbody, [a, b, c], create, update);
      expect(updates).toBe(0);
      const b2 = { label: "b!" };
      reconcileNonKeyedList(tbody, [a, b2, c], create, update);
      expect(updates).toBe(1);
      expect(tbody.children[1]?.textContent).toBe("b!");
      expect(tbody.children[0]?.textContent).toBe("a");
      expect(tbody.children[2]?.textContent).toBe("c");
      updates = 0;
      reconcileNonKeyedList(tbody, [a, b2, c], create, update);
      expect(updates).toBe(0);
    });
  });

  test("all-new refs same length update in place (no recreate)", () => {
    withDom((document) => {
      const tbody = document.createElement("tbody");
      let creates = 0;
      let updates = 0;
      const create = (item: { label: string }) => {
        creates++;
        const tr = document.createElement("tr");
        tr.textContent = item.label;
        return tr;
      };
      const update = (tr: HTMLElement, item: { label: string }) => {
        updates++;
        tr.textContent = item.label;
      };
      reconcileNonKeyedList(tbody, [{ label: "a" }], create, update);
      expect(creates).toBe(1);
      const oldRow = tbody.children[0];
      creates = 0;
      reconcileNonKeyedList(tbody, [{ label: "a" }], create, update);
      expect(creates).toBe(0);
      expect(updates).toBe(1);
      expect(tbody.children[0]).toBe(oldRow);
      expect(tbody.children[0]?.textContent).toBe("a");
    });
  });

  test("full dirty same-length list updates in place", () => {
    withDom((document) => {
      const tbody = document.createElement("tbody");
      let creates = 0;
      let updates = 0;
      const create = (item: { label: string }) => {
        creates++;
        const tr = document.createElement("tr");
        tr.textContent = item.label;
        return tr;
      };
      const update = (tr: HTMLElement, item: { label: string }) => {
        updates++;
        tr.textContent = item.label;
      };
      const first = [{ label: "a" }, { label: "b" }, { label: "c" }];
      reconcileNonKeyedList(tbody, first, create, update);
      expect(creates).toBe(3);
      const oldRows = [...tbody.children];
      creates = 0;
      updates = 0;
      reconcileNonKeyedList(
        tbody,
        [{ label: "x" }, { label: "y" }, { label: "z" }],
        create,
        update,
      );
      expect(creates).toBe(0);
      expect(updates).toBe(3);
      expect(tbody.children.length).toBe(3);
      expect(tbody.children[0]?.textContent).toBe("x");
      expect(tbody.children[0]).toBe(oldRows[0]);
    });
  });

  test("two swapped refs update in place (no DOM-swap fast path)", () => {
    withDom((document) => {
      const tbody = document.createElement("tbody");
      let updates = 0;
      const a = { label: "a" };
      const b = { label: "b" };
      const c = { label: "c" };
      const create = (item: { label: string }) => {
        const tr = document.createElement("tr");
        tr.textContent = item.label;
        return tr;
      };
      const update = (tr: HTMLElement, item: { label: string }) => {
        updates++;
        tr.textContent = item.label;
      };
      reconcileNonKeyedList(tbody, [a, b, c], create, update);
      const row0 = tbody.children[0];
      updates = 0;
      reconcileNonKeyedList(tbody, [c, b, a], create, update);
      expect(updates).toBe(2);
      expect(tbody.children[0]).toBe(row0);
      expect(tbody.children[0]?.textContent).toBe("c");
      expect(tbody.children[2]?.textContent).toBe("a");
    });
  });

  test("clear uses textContent empty", () => {
    withDom((document) => {
      const tbody = document.createElement("tbody");
      const create = (item: { label: string }) => {
        const tr = document.createElement("tr");
        tr.textContent = item.label;
        return tr;
      };
      reconcileNonKeyedList(tbody, [{ label: "a" }, { label: "b" }], create, () => {});
      expect(tbody.children.length).toBe(2);
      reconcileNonKeyedList(tbody, [], create, () => {});
      expect(tbody.children.length).toBe(0);
    });
  });
});
