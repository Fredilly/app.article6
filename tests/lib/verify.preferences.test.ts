import { describe, expect, it } from "@jest/globals";
import {
  PreferenceStorageError,
  appendPreferenceEvent,
  listPreferenceEvents,
  makeEventId,
  makePairKey,
} from "@/lib/verify/preferences";

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

describe("verify preferences", () => {
  it("builds order-independent pair keys", () => {
    expect(makePairKey("evidence:b", "evidence:a")).toBe("evidence:a::evidence:b");
    expect(makePairKey("evidence:a", "evidence:b")).toBe("evidence:a::evidence:b");
  });

  it("builds deterministic event ids", async () => {
    const first = await makeEventId({ runId: "run-1", ruleId: "R-1", pairKey: "a::b", choice: "left", seq: 1 });
    const second = await makeEventId({ runId: "run-1", ruleId: "R-1", pairKey: "a::b", choice: "left", seq: 1 });
    const changed = await makeEventId({ runId: "run-1", ruleId: "R-1", pairKey: "a::b", choice: "left", seq: 2 });

    expect(first).toBe(second);
    expect(changed).not.toBe(first);
  });

  it("appends events with incrementing seq", async () => {
    const storage = ensureLocalStorage();
    storage.clear();

    await appendPreferenceEvent("run-42", {
      methodCode: "AR-1",
      version: "v1",
      ruleId: "R-1",
      pairKey: "left::right",
      leftEvidenceKey: "left",
      rightEvidenceKey: "right",
      choice: "left",
      rationale: "Higher confidence",
    });

    await appendPreferenceEvent("run-42", {
      methodCode: "AR-1",
      version: "v1",
      pairKey: "left::right",
      leftEvidenceKey: "left",
      rightEvidenceKey: "right",
      choice: "tie",
    });

    const events = listPreferenceEvents("AR-1", "v1", "run-42");
    expect(events).toHaveLength(2);
    expect(events[0]?.seq).toBe(1);
    expect(events[1]?.seq).toBe(2);
    expect(events[0]?.eventId).toBeTruthy();
    expect(events[1]?.eventId).toBeTruthy();
  });

  it("throws typed error on storage write failure", async () => {
    const storage = ensureLocalStorage();
    storage.clear();
    const originalSetItem = storage.setItem.bind(storage);
    (storage as Storage).setItem = (() => {
      throw new Error("quota exceeded");
    }) as Storage["setItem"];

    await expect(
      appendPreferenceEvent("run-99", {
        methodCode: "AR-1",
        version: "v1",
        pairKey: "a::b",
        leftEvidenceKey: "a",
        rightEvidenceKey: "b",
        choice: "skip",
      }),
    ).rejects.toBeInstanceOf(PreferenceStorageError);

    (storage as Storage).setItem = originalSetItem;
  });
});
