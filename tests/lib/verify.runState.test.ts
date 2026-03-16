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
  getVerifyWizardStepDetails,
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
  it("returns in progress until evidence prerequisites are complete", () => {
    const status = getVerifyRunStatusDetails({
      selectedRuleId: "R-1",
      aoiHash: "aoi-1",
      stacItemIds: ["item-1"],
      selectedStacItemId: "item-1",
      linkedRuleIds: [],
      minutes: "",
      outcomeNote: "",
    });

    expect(status.status).toBe("in_progress");
    expect(status.label).toBe("In progress");
    expect(status.missing).toEqual(["Link evidence to the rule"]);
    expect(status.nextAction).toBe("Link evidence to the rule");
  });

  it("requires explicit reviewer save after workspace prerequisites are met", () => {
    const status = getVerifyRunStatusDetails({
      selectedRuleId: "R-1",
      aoiHash: "aoi-1",
      stacItemIds: ["item-1"],
      selectedStacItemId: "item-1",
      linkedRuleIds: ["R-1"],
      reviewerArtifactSavedAt: null,
      finalizedAt: null,
      minutes: "",
      outcomeNote: "",
    });

    expect(status.status).toBe("in_progress");
    expect(status.label).toBe("In progress");
    expect(status.missing).toEqual(["Save reviewer artifact"]);
    expect(status.nextAction).toBe("Save reviewer artifact");
  });

  it("does not treat typed reviewer text as saved state", () => {
    const status = getVerifyRunStatusDetails({
      selectedRuleId: "R-1",
      aoiHash: "aoi-1",
      stacItemIds: ["item-1"],
      selectedStacItemId: "item-1",
      linkedRuleIds: ["R-1"],
      reviewerArtifactSavedAt: null,
      finalizedAt: null,
      minutes: "Typed but not saved",
      outcomeNote: "",
    });

    expect(status.status).toBe("in_progress");
    expect(status.missing).toEqual(["Save reviewer artifact"]);
  });

  it("returns finalized only after explicit finalization", () => {
    const status = getVerifyRunStatusDetails({
      selectedRuleId: "R-1",
      aoiHash: "aoi-1",
      stacItemIds: ["item-1"],
      selectedStacItemId: "item-1",
      linkedRuleIds: ["R-1"],
      reviewerArtifactSavedAt: "2026-01-01T00:05:00Z",
      finalizedAt: "2026-01-01T00:06:00Z",
      minutes: "",
      outcomeNote: "Outcome stable.",
    });

    expect(status.status).toBe("finalized");
    expect(status.label).toBe("Finalized");
    expect(status.missing).toEqual([]);
    expect(status.nextAction).toBeNull();
  });

  it("requires finalization after a saved reviewer artifact", () => {
    const status = getVerifyRunStatusDetails({
      selectedRuleId: "R-1",
      aoiHash: "aoi-1",
      stacItemIds: ["item-1"],
      selectedStacItemId: "item-1",
      linkedRuleIds: ["R-1"],
      reviewerArtifactSavedAt: "2026-01-01T00:05:00Z",
      finalizedAt: null,
      minutes: "Saved reviewer text",
      outcomeNote: "",
    });

    expect(status.status).toBe("ready_to_finalize");
    expect(status.label).toBe("Ready to finalize");
    expect(status.missing).toEqual(["Finalize run"]);
    expect(status.nextAction).toBe("Finalize run");
  });
});

describe("getVerifyWizardStepDetails", () => {
  it("resolves steps 1 through 7 in order", () => {
    expect(getVerifyWizardStepDetails({}).activeStep).toBe(1);
    expect(getVerifyWizardStepDetails({ selectedRuleId: "R-1" }).activeStep).toBe(2);
    expect(getVerifyWizardStepDetails({ selectedRuleId: "R-1", aoiHash: "aoi" }).activeStep).toBe(3);
    expect(getVerifyWizardStepDetails({ selectedRuleId: "R-1", aoiHash: "aoi", stacItemIds: ["item-1"] }).activeStep).toBe(4);
    expect(
      getVerifyWizardStepDetails({
        selectedRuleId: "R-1",
        aoiHash: "aoi",
        stacItemIds: ["item-1"],
        selectedStacItemId: "item-1",
      }).activeStep,
    ).toBe(5);
    expect(
      getVerifyWizardStepDetails({
        selectedRuleId: "R-1",
        aoiHash: "aoi",
        stacItemIds: ["item-1"],
        selectedStacItemId: "item-1",
        linkedRuleIds: ["R-1"],
      }).activeStep,
    ).toBe(6);
    expect(
      getVerifyWizardStepDetails({
        selectedRuleId: "R-1",
        aoiHash: "aoi",
        stacItemIds: ["item-1"],
        selectedStacItemId: "item-1",
        linkedRuleIds: ["R-1"],
        snapshotExportedAt: "2026-01-01T00:00:00Z",
      }).activeStep,
    ).toBe(6);
    expect(
      getVerifyWizardStepDetails({
        selectedRuleId: "R-1",
        aoiHash: "aoi",
        stacItemIds: ["item-1"],
        selectedStacItemId: "item-1",
        linkedRuleIds: ["R-1"],
        snapshotExportedAt: "2026-01-01T00:00:00Z",
        reviewerArtifactSavedAt: "2026-01-01T00:05:00Z",
      }).activeStep,
    ).toBe(7);
  });

  it("reports completion only after finalization", () => {
    const details = getVerifyWizardStepDetails({
      selectedRuleId: "R-1",
      aoiHash: "aoi",
      stacItemIds: ["item-1"],
      selectedStacItemId: "item-1",
      linkedRuleIds: ["R-1"],
      snapshotExportedAt: "2026-01-01T00:00:00Z",
      reviewerArtifactSavedAt: "2026-01-01T00:05:00Z",
      finalizedAt: "2026-01-01T00:06:00Z",
    });

    expect(details.activeStep).toBeNull();
    expect(details.isComplete).toBe(true);
    expect(details.nextAction).toBeNull();
  });

  it("keeps export as optional utility instead of a required active step", () => {
    const details = getVerifyWizardStepDetails({
      selectedRuleId: "R-1",
      aoiHash: "aoi",
      stacItemIds: ["item-1"],
      selectedStacItemId: "item-1",
      linkedRuleIds: ["R-1"],
    });

    expect(details.steps.find((step) => step.id === 6)?.active).toBe(true);
    expect(details.nextAction).toBe("Save reviewer artifact");
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
    expect(bundle.savedReviewerArtifactAt).toBeNull();
    expect(bundle.finalizedAt).toBeNull();
    expect(bundle.loadedFromRunId).toBeNull();
    expect(bundle.derivedFromRunId).toBeNull();
    expect(bundle.isEditedDraft).toBe(false);
    expect(bundle.draftMinutes).toBe("");
    expect(bundle.draftOutcomeNote).toBe("");
  });

  it("creates a fresh run with a new run id and cleared review state", () => {
    const first = createVerifierRunBundle("AR-2", "v2");
    const second = createVerifierRunBundle("AR-2", "v2");

    expect(second.runContext.runId).not.toBe(first.runContext.runId);
    expect(second.exportedAt).toBeNull();
    expect(second.minutes).toBe("");
    expect(second.outcomeNote).toBe("");
    expect(second.draftMinutes).toBe("");
    expect(second.draftOutcomeNote).toBe("");
    expect(second.delta).toBe("");
    expect(second.impact).toBe("");
    expect(second.tasks).toEqual([]);
  });

  it("persists and reads verifier minutes", () => {
    const storage = ensureLocalStorage();
    storage.clear();

    const bundle = createVerifierRunBundle("AR-2", "v2");
    const updated = {
      ...bundle,
      minutes: "Checked AOI and evidence.",
      draftMinutes: "Checked AOI and evidence.",
      outcomeNote: "Looks stable.",
      draftOutcomeNote: "Looks stable.",
      savedReviewerArtifactAt: "2026-01-01T00:00:00Z",
      finalizedAt: "2026-01-01T00:01:00Z",
      loadedFromRunId: "run-source",
      derivedFromRunId: "run-source",
      isEditedDraft: true,
    };
    persistVerifierRunBundle("AR-2", "v2", updated);

    const read = readVerifierRunBundle("AR-2", "v2");
    expect(read.minutes).toBe("Checked AOI and evidence.");
    expect(read.outcomeNote).toBe("Looks stable.");
    expect(read.draftMinutes).toBe("Checked AOI and evidence.");
    expect(read.draftOutcomeNote).toBe("Looks stable.");
    expect(read.savedReviewerArtifactAt).toBe("2026-01-01T00:00:00Z");
    expect(read.finalizedAt).toBe("2026-01-01T00:01:00Z");
    expect(read.loadedFromRunId).toBe("run-source");
    expect(read.derivedFromRunId).toBe("run-source");
    expect(read.isEditedDraft).toBe(true);
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

  it("preserves finalized history when a derived draft is saved as a new run", () => {
    const storage = ensureLocalStorage();
    storage.clear();
    const base = createVerifierRunBundle("AR-5", "v5");
    saveCurrentRunToHistory("AR-5", "v5", {
      ...base,
      runContext: { runId: "run-final", createdAt: "2026-01-05T00:00:00Z" },
      savedReviewerArtifactAt: "2026-01-05T00:04:00Z",
      finalizedAt: "2026-01-05T00:05:00Z",
      minutes: "Final reviewer text",
      draftMinutes: "Final reviewer text",
      selectedRuleId: "R-1",
      linkedRuleIds: ["R-1"],
      aoi: null,
      evidencePins: [],
      verificationRuns: [],
      selectedStacItemId: "item-1",
    });

    const loaded = loadRunFromHistory("AR-5", "v5", "run-final");
    expect(loaded?.finalizedAt).toBe("2026-01-05T00:05:00Z");

    saveCurrentRunToHistory("AR-5", "v5", {
      ...(loaded as NonNullable<typeof loaded>),
      runContext: { runId: "run-derived", createdAt: "2026-01-05T00:10:00Z" },
      loadedFromRunId: "run-final",
      derivedFromRunId: "run-final",
      finalizedAt: null,
      isEditedDraft: true,
      draftMinutes: "Edited derived text",
      minutes: "Final reviewer text",
    });

    const preserved = loadRunFromHistory("AR-5", "v5", "run-final");
    const derived = loadRunFromHistory("AR-5", "v5", "run-derived");
    expect(preserved?.finalizedAt).toBe("2026-01-05T00:05:00Z");
    expect(preserved?.minutes).toBe("Final reviewer text");
    expect(derived?.loadedFromRunId).toBe("run-final");
    expect(derived?.isEditedDraft).toBe(true);
    expect(derived?.draftMinutes).toBe("Edited derived text");
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
