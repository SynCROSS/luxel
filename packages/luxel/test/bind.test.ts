import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { bindClick, bindDelegatedClicks } from "../src/runtime/bind.ts";

describe("bindClick", () => {
  test("passes MouseEvent to handler", () => {
    const window = new Window();
    const doc = window.document;
    const button = doc.createElement("button");
    let received: MouseEvent | undefined;
    bindClick(button, (event) => {
      received = event;
    });
    button.click();
    expect(received).toBeDefined();
    expect(received?.target).toBe(button);
  });
});

describe("bindDelegatedClicks", () => {
  test("dispatches by data-luxel-click on descendant", () => {
    const window = new Window();
    const doc = window.document;
    const tbody = doc.createElement("tbody");
    const tr = doc.createElement("tr");
    const a = doc.createElement("a");
    a.setAttribute("data-luxel-click", "selectRow");
    const span = doc.createElement("span");
    a.appendChild(span);
    tr.appendChild(a);
    tbody.appendChild(tr);
    let name = "";
    bindDelegatedClicks(tbody, (n) => {
      name = n;
    });
    span.click();
    expect(name).toBe("selectRow");
  });

  test("ignores clicks outside marked descendants", () => {
    const window = new Window();
    const doc = window.document;
    const tbody = doc.createElement("tbody");
    const tr = doc.createElement("tr");
    tbody.appendChild(tr);
    let calls = 0;
    bindDelegatedClicks(tbody, () => {
      calls++;
    });
    tr.click();
    expect(calls).toBe(0);
  });
});
