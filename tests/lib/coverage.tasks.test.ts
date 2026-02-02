import { describe, expect, it } from "@jest/globals";
import { addCoverageTask, buildCoverageTaskKey, loadCoverageTasks } from "@/lib/coverage/tasks";

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

describe("coverage tasks", () => {
  it("dedupes tasks for the same rule id", () => {
    const storage = ensureLocalStorage();
    storage.clear();

    const first = addCoverageTask({ methodCode: "AR-ACM0003", version: "v02-0", ruleId: "R-1-0001" });
    expect(first.action).toBe("added");
    expect(loadCoverageTasks("AR-ACM0003", "v02-0")).toHaveLength(1);

    const second = addCoverageTask({ methodCode: "AR-ACM0003", version: "v02-0", ruleId: "R-1-0001" });
    expect(second.action).toBe("removed");
    expect(loadCoverageTasks("AR-ACM0003", "v02-0")).toHaveLength(0);
  });

  it("builds a stable coverage task key", () => {
    const key = buildCoverageTaskKey("AR-ACM0003", "v02-0", "R-1-0001");
    expect(key).toBe("coverage:AR-ACM0003@v02-0:R-1-0001");
  });
});
