import { describe, expect, it } from "@jest/globals";
import {
  addLinkedRuleId,
  addLinkedRuleIdToStorage,
  addTaskWithText,
  buildLinkedRulesKey,
  buildVerifyRunKey,
  buildRunSummary,
  createVerifierRunBundle,
  deleteRunFromHistory,
  getVerifyRunStatusDetails,
  normalizeMethodCode,
  normalizeVersion,
  persistVerifierRunBundle,
  readLinkedRuleIdsFromStorage,
  readRunHistory,
  readVerifierRunBundle,
  parseLinkedRuleId,
  saveCurrentRunToHistory,
  loadRunFromHistory,
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

describe("getVerifyRunStatusDetails", () => {
  it("returns in progress until export prerequisites are complete", () => {
    const status = getVerifyRunStatusDetails({
      selectedRuleId: "R-1",
      aoiHash: "aoi-1",
      stacItemIds: ["item-1"],
      selectedStacItemId: "item-1",
      linkedRuleIds: [],
      snapshotExportedAt: null,
      minutes: "",
      outcomeNote: "",
    });

    expect(status.status).toBe("in_progress");
    expect(status.missing).toEqual(["Link evidence to the rule", "Export the evidence pack"]);
    expect(status.nextAction).toBe("Link evidence to the rule");
  });

  it("returns evidence pack complete after export until reviewer artifact exists", () => {
    const status = getVerifyRunStatusDetails({
      selectedRuleId: "R-1",
      aoiHash: "aoi-1",
      stacItemIds: ["item-1"],
      selectedStacItemId: "item-1",
      linkedRuleIds: ["R-1"],
      snapshotExportedAt: "2026-01-01T00:00:00Z",
      minutes: "",
      outcomeNote: "",
    });

    expect(status.status).toBe("evidence_pack_complete");
    expect(status.missing).toEqual(["Add verifier minutes or an outcome note"]);
  });

  it("returns review complete when minutes or outcome note is present", () => {
    const status = getVerifyRunStatusDetails({
      selectedRuleId: "R-1",
      aoiHash: "aoi-1",
      stacItemIds: ["item-1"],
      selectedStacItemId: "item-1",
      linkedRuleIds: ["R-1"],
      snapshotExportedAt: "2026-01-01T00:00:00Z",
      minutes: "",
      outcomeNote: "Outcome stable.",
    });

    expect(status.status).toBe("review_complete");
    expect(status.missing).toEqual([]);
    expect(status.nextAction).toBeNull();
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

describe("normalizeLinkedRules", () => {
  it("normalizes method codes and versions", () => {
    expect(normalizeMethodCode("AR-AMS0003@v03-0")).toBe("AR-AMS0003");
    expect(normalizeVersion("03-0")).toBe("v03-0");
    expect(normalizeVersion("v/v03-0")).toBe("v03-0");
  });
});

describe("addLinkedRuleIdToStorage", () => {
  it("dedupes and persists linked rule ids", () => {
    const storage = ensureLocalStorage();
    storage.clear();
    addLinkedRuleIdToStorage("VM-1", "v1", "R-2");
    addLinkedRuleIdToStorage("VM-1", "v1", "R-1");
    addLinkedRuleIdToStorage("VM-1", "v1", "R-1");

    expect(readLinkedRuleIdsFromStorage("VM-1", "v1")).toEqual(["R-1", "R-2"]);
  });
});

describe("readLinkedRuleIdsFromStorage", () => {
  it("migrates legacy @ key to canonical key", () => {
    const storage = ensureLocalStorage();
    storage.clear();
    const legacyKey = "verifyLinkedRules:VM-3@v1";
    storage.setItem(legacyKey, JSON.stringify(["R-9"]));

    expect(readLinkedRuleIdsFromStorage("VM-3", "v1")).toEqual(["R-9"]);
    expect(storage.getItem(legacyKey)).toBeNull();
    expect(storage.getItem(buildLinkedRulesKey("VM-3", "v1"))).toBe(JSON.stringify(["R-9"]));
  });

  it("merges legacy keys for the same method", () => {
    const storage = ensureLocalStorage();
    storage.clear();
    storage.setItem("verifyLinkedRules:VM-4@v03-0", JSON.stringify(["R-2"]));
    storage.setItem("verifyLinkedRules:VM-4v03-0", JSON.stringify(["R-1"]));

    expect(readLinkedRuleIdsFromStorage("VM-4", "03-0")).toEqual(["R-1", "R-2"]);
    expect(storage.getItem(buildLinkedRulesKey("VM-4", "v03-0"))).toBe(JSON.stringify(["R-1", "R-2"]));
  });
});

describe("subscribeLinkedRuleIds", () => {
  it("fires on storage updates", () => {
    ensureLocalStorage();
    let calls = 0;
    const unsubscribe = subscribeLinkedRuleIds(() => {
      calls += 1;
    });
    addLinkedRuleIdToStorage("VM-2", "v1", "R-9");
    unsubscribe();

    expect(calls).toBe(1);
  });
});

describe("verifier run bundle storage", () => {
  it("hydrates defaults when storage is empty", () => {
    const storage = ensureLocalStorage();
    storage.clear();

    const bundle = readVerifierRunBundle("AR-1", "v1");
    expect(bundle.runContext.runId).toContain("AR-1-v1-");
    expect(bundle.checklist.length).toBeGreaterThan(0);
    expect(bundle.tasks).toEqual([]);
  });

  it("creates a fresh run with a new run id and cleared review state", () => {
    const first = createVerifierRunBundle("AR-2", "v2");
    const second = createVerifierRunBundle("AR-2", "v2");

    expect(second.runContext.runId).not.toBe(first.runContext.runId);
    expect(second.exportedAt).toBeNull();
    expect(second.minutes).toBe("");
    expect(second.outcomeNote).toBe("");
    expect(second.delta).toBe("");
    expect(second.impact).toBe("");
    expect(second.tasks).toEqual([]);
  });

  it("persists and reads verifier minutes", () => {
    const storage = ensureLocalStorage();
    storage.clear();

    const bundle = createVerifierRunBundle("AR-2", "v2");
    const updated = { ...bundle, minutes: "Checked AOI and evidence." };
    persistVerifierRunBundle("AR-2", "v2", updated);

    const read = readVerifierRunBundle("AR-2", "v2");
    expect(read.minutes).toBe("Checked AOI and evidence.");
    expect(read.outcomeNote).toBe("");
    expect(storage.getItem(buildVerifyRunKey("AR-2", "v2"))).toBeTruthy();
  });
});

describe("addTaskWithText", () => {
  it("creates a task with timestamps and text", () => {
    const task = addTaskWithText("Review delta");
    expect(task.text).toBe("Review delta");
    expect(task.done).toBe(false);
    expect(task.createdAt).toBeTruthy();
    expect(task.updatedAt).toBeTruthy();
  });
});

describe("run history storage", () => {
  it("caps run history at 10 entries", () => {
    const storage = ensureLocalStorage();
    storage.clear();

    const base = createVerifierRunBundle("AR-1", "v1");
    for (let i = 0; i < 12; i += 1) {
      saveCurrentRunToHistory("AR-1", "v1", {
        ...base,
        runContext: { runId: `run-${i}`, createdAt: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z` },
        selectedRuleId: null,
        linkedRuleIds: [],
        aoi: null,
        evidencePins: [],
        verificationRuns: [],
        selectedStacItemId: null,
      });
    }

    const history = readRunHistory("AR-1", "v1");
    expect(history).toHaveLength(10);
    expect(history[0]?.runId).toBe("run-11");
  });

  it("loads run bundle by runId", () => {
    const storage = ensureLocalStorage();
    storage.clear();
    const base = createVerifierRunBundle("AR-2", "v2");
    saveCurrentRunToHistory("AR-2", "v2", {
      ...base,
      runContext: { runId: "run-xyz", createdAt: "2026-01-02T00:00:00Z" },
      selectedRuleId: "R-1",
      minutes: "Loaded run",
      outcomeNote: "Outcome note",
      delta: "Changed AOI boundary.",
      impact: "May reduce coverage.",
      tasks: [
        {
          id: "task-1",
          text: "Re-run evidence export",
          done: false,
          createdAt: "2026-01-02T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        },
      ],
      linkedRuleIds: ["R-1"],
      aoi: null,
      evidencePins: [],
      verificationRuns: [],
      selectedStacItemId: null,
    });

    const loaded = loadRunFromHistory("AR-2", "v2", "run-xyz");
    expect(loaded?.runContext.runId).toBe("run-xyz");
    expect(loaded?.selectedRuleId).toBe("R-1");
    expect(loaded?.minutes).toBe("Loaded run");
    expect(loaded?.outcomeNote).toBe("Outcome note");
    expect(loaded?.delta).toBe("Changed AOI boundary.");
    expect(loaded?.tasks).toHaveLength(1);
  });

  it("deletes a run from history", () => {
    ensureLocalStorage();
    saveCurrentRunToHistory("AR-3", "v3", {
      ...createVerifierRunBundle("AR-3", "v3"),
      runContext: { runId: "run-del", createdAt: "2026-01-03T00:00:00Z" },
      selectedRuleId: null,
      linkedRuleIds: [],
      aoi: null,
      evidencePins: [],
      verificationRuns: [],
      selectedStacItemId: null,
    });

    const afterDelete = deleteRunFromHistory("AR-3", "v3", "run-del");
    expect(afterDelete.find((entry) => entry.runId === "run-del")).toBeUndefined();
  });
});
