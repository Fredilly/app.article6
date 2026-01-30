import { describe, expect, it } from "@jest/globals";
import {
  addLinkedRuleId,
  addLinkedRuleIdToStorage,
  buildLinkedRulesKey,
  buildRunSummary,
  readLinkedRuleIdsFromStorage,
  parseLinkedRuleId,
  subscribeLinkedRuleIds,
} from "@/lib/verify/runState";

function ensureLocalStorage(): Storage {
  if (typeof localStorage !== "undefined") return localStorage;
  let store: Record<string, string> = {};
  const memoryStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
  (globalThis as unknown as { localStorage: Storage }).localStorage = memoryStorage;
  return memoryStorage;
}

describe("buildRunSummary", () => {
  it("dedupes and sorts item and rule ids", () => {
    const summary = buildRunSummary({
      stac: { itemIds: ["b", "a", "a", "c"] },
      linkage: { linkedRuleIds: ["r2", "r1", "r1"] },
    });

    expect(summary.stac.itemIds).toEqual(["a", "b", "c"]);
    expect(summary.linkage.linkedRuleIds).toEqual(["r1", "r2"]);
  });
});

describe("addLinkedRuleId", () => {
  it("adds new active rule ids once", () => {
    const first = addLinkedRuleId([], "R-1");
    const second = addLinkedRuleId(first, "R-2");
    const duplicate = addLinkedRuleId(second, "R-2");

    expect(first).toEqual(["R-1"]);
    expect(second).toEqual(["R-1", "R-2"]);
    expect(duplicate).toEqual(["R-1", "R-2"]);
  });
});

describe("parseLinkedRuleId", () => {
  it("prefers rule param and parses hash rules", () => {
    expect(parseLinkedRuleId({ ruleParam: "R-100", hash: "#r-R-2" })).toBe("R-100");
    expect(parseLinkedRuleId({ ruleParam: null, hash: "#r-R-2" })).toBe("R-2");
    expect(parseLinkedRuleId({ ruleParam: null, hash: "#R-3" })).toBe("R-3");
    expect(parseLinkedRuleId({ ruleParam: null, hash: "#s-S-1" })).toBeNull();
  });
});

describe("addLinkedRuleIdToStorage", () => {
  it("dedupes and persists linked rule ids", () => {
    const storage = ensureLocalStorage();
    const key = buildLinkedRulesKey("VM-1", "v1");
    storage.clear();
    addLinkedRuleIdToStorage(key, "R-2");
    addLinkedRuleIdToStorage(key, "R-1");
    addLinkedRuleIdToStorage(key, "R-1");

    expect(readLinkedRuleIdsFromStorage("VM-1", "v1")).toEqual(["R-1", "R-2"]);
  });
});

describe("subscribeLinkedRuleIds", () => {
  it("fires on storage updates", () => {
    ensureLocalStorage();
    const key = buildLinkedRulesKey("VM-2", "v1");
    let calls = 0;
    const unsubscribe = subscribeLinkedRuleIds(() => {
      calls += 1;
    });
    addLinkedRuleIdToStorage(key, "R-9");
    unsubscribe();

    expect(calls).toBe(1);
  });
});
