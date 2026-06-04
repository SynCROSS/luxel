import { describe, expect, test } from "bun:test";
import { ResourceStore } from "../src/resource-store/store.ts";

describe("ResourceStore", () => {
  test("stores and retrieves a value by stable key", () => {
    const store = new ResourceStore();
    store.set("route:index:message", { message: "Hello Luxel" });
    expect(store.get("route:index:message")).toEqual({ message: "Hello Luxel" });
  });

  test("revalidateTag bumps generation for tagged entries only", () => {
    const store = new ResourceStore();
    store.set("a", 1, { tags: ["posts"] });
    store.set("b", 2, { tags: ["users"] });
    expect(store.getGeneration("a")).toBe(0);
    expect(store.getGeneration("b")).toBe(0);

    store.revalidateTag("posts");

    expect(store.getGeneration("a")).toBe(1);
    expect(store.getGeneration("b")).toBe(0);
    expect(store.get("a")).toBe(1);
    expect(store.get("b")).toBe(2);
  });

  test("set stores HTTP cache metadata on the entry", () => {
    const store = new ResourceStore();
    store.set("route:about:summary", "About page", {
      cache: { maxAge: 60, staleWhileRevalidate: 300 },
    });
    expect(store.getEntry("route:about:summary")).toEqual({
      key: "route:about:summary",
      value: "About page",
      tags: [],
      cache: { maxAge: 60, staleWhileRevalidate: 300 },
      generation: 0,
    });
  });

  test("author key override stores under stable key not compiler slot name", () => {
    const store = new ResourceStore();
    store.set("route:index:default", { n: 1 }, { key: "custom:counter" });
    expect(store.get("custom:counter")).toEqual({ n: 1 });
    expect(store.get("route:index:default")).toBeUndefined();
  });

  test("snapshot captures values and generations for hydration handoff", () => {
    const store = new ResourceStore();
    store.set("route:index:message", { message: "hi" }, { tags: ["home"] });
    store.revalidateTag("home");

    expect(store.snapshot()).toEqual({
      "route:index:message": {
        value: { message: "hi" },
        generation: 1,
        tags: ["home"],
        cache: {},
      },
    });
  });
});
