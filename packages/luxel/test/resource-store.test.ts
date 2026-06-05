import { describe, expect, test } from "bun:test";
import { ResourceStore } from "../src/resource-store/store.ts";

describe("ResourceStore", () => {
  test("stores and retrieves a value by stable key", () => {
    const store = new ResourceStore();
    store.set("route:index:message", { message: "Hello Luxel" });
    expect(store.get("route:index:message")).toEqual({ message: "Hello Luxel" });
  });

  test("revalidateTag marks tagged entries stale", () => {
    const store = new ResourceStore();
    store.set("a", 1, { tags: ["posts"] });
    store.revalidateTag("posts");
    expect(store.isStale("a")).toBe(true);
    expect(store.isStale("missing")).toBe(true);
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
      stale: false,
    });
  });

  test("author key override stores under stable key not compiler slot name", () => {
    const store = new ResourceStore();
    store.set("route:index:default", { n: 1 }, { key: "custom:counter" });
    expect(store.get("custom:counter")).toEqual({ n: 1 });
    expect(store.get("route:index:default")).toBeUndefined();
  });

  test("mergeSnapshot keeps newer generation only", () => {
    const store = new ResourceStore();
    store.set("a", { v: 1 }, { key: "a" });
    store.mergeSnapshot({
      a: { value: { v: 2 }, generation: 1, tags: [], cache: {}, stale: false },
      b: { value: { v: 3 }, generation: 0, tags: [], cache: {}, stale: false },
    });
    expect(store.get("a")).toEqual({ v: 2 });
    expect(store.get("b")).toEqual({ v: 3 });
    store.mergeSnapshot({
      a: { value: { v: 0 }, generation: 0, tags: [], cache: {}, stale: false },
    });
    expect(store.get("a")).toEqual({ v: 2 });
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
        stale: true,
      },
    });
  });
});
