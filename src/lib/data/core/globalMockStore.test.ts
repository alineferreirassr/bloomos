import { describe, expect, it } from "vitest";
import { getGlobalMockStore } from "@/lib/data/core/globalMockStore";

describe("getGlobalMockStore", () => {
  it("initializes a store exactly once — a second call with the same key does not re-run init", () => {
    let initCount = 0;
    const init = () => {
      initCount += 1;
      return [] as string[];
    };
    getGlobalMockStore("test.counted", init);
    getGlobalMockStore("test.counted", init);
    expect(initCount).toBe(1);
  });

  it("two lookups with the same key share the exact same underlying value — the whole point of a global singleton", () => {
    const first = getGlobalMockStore<string[]>("test.shared", () => []);
    first.set(["a"]);
    const second = getGlobalMockStore<string[]>("test.shared", () => []);
    expect(second.get()).toEqual(["a"]);
  });

  it("two different keys never share state", () => {
    const a = getGlobalMockStore<number[]>("test.a", () => []);
    const b = getGlobalMockStore<number[]>("test.b", () => []);
    a.set([1, 2, 3]);
    expect(b.get()).toEqual([]);
  });
});
