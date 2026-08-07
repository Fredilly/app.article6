import { expect, jest, test } from "@jest/globals";
import {
  VM0007_EVIDENCE_MAP_DRAFT_PREFIX,
  VM0007_GAP_REPORT_AUDIT_PREFIX,
  Vm0007StorageWriteError,
  writeVm0007Storage,
} from "@/lib/preverif/vm0007Storage";

function makeStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => { values.set(key, String(value)); },
  } as Storage;
}

function seedPair(storage: Storage, auditId: string, generatedAt: string): void {
  storage.setItem(`${VM0007_GAP_REPORT_AUDIT_PREFIX}${auditId}`, JSON.stringify({ generatedAt }));
  storage.setItem(`${VM0007_EVIDENCE_MAP_DRAFT_PREFIX}${auditId}`, JSON.stringify({ generatedAt }));
}

function quotaError(): Error {
  const error = new Error("localStorage quota exceeded") as Error & { name: string };
  error.name = "QuotaExceededError";
  return error;
}

test("prunes oldest complete pairs first, retains newest three, and leaves unrelated keys untouched", () => {
  const storage = makeStorage();
  seedPair(storage, "oldest", "2026-01-01T00:00:00.000Z");
  seedPair(storage, "second-oldest", "2026-01-02T00:00:00.000Z");
  seedPair(storage, "middle", "2026-01-03T00:00:00.000Z");
  seedPair(storage, "newest-1", "2026-01-04T00:00:00.000Z");
  seedPair(storage, "newest-2", "2026-01-05T00:00:00.000Z");
  seedPair(storage, "newest-3", "2026-01-06T00:00:00.000Z");
  storage.setItem("article6:unrelated", "keep me");

  let writes = 0;
  const originalSetItem = storage.setItem.bind(storage);
  jest.spyOn(storage, "setItem").mockImplementation((key, value) => {
    writes += 1;
    if (writes === 1) throw quotaError();
    originalSetItem(key, value);
  });

  writeVm0007Storage(storage, `${VM0007_GAP_REPORT_AUDIT_PREFIX}current`, "large-audit", "current");

  expect(storage.getItem(`${VM0007_GAP_REPORT_AUDIT_PREFIX}oldest`)).toBeNull();
  expect(storage.getItem(`${VM0007_EVIDENCE_MAP_DRAFT_PREFIX}oldest`)).toBeNull();
  expect(storage.getItem(`${VM0007_GAP_REPORT_AUDIT_PREFIX}second-oldest`)).toBeNull();
  expect(storage.getItem(`${VM0007_EVIDENCE_MAP_DRAFT_PREFIX}second-oldest`)).toBeNull();
  expect(storage.getItem(`${VM0007_GAP_REPORT_AUDIT_PREFIX}middle`)).toBeNull();
  for (const auditId of ["newest-1", "newest-2", "newest-3", "current"]) {
    expect(storage.getItem(`${VM0007_GAP_REPORT_AUDIT_PREFIX}${auditId}`)).not.toBeNull();
  }
  expect(storage.getItem("article6:unrelated")).toBe("keep me");
  expect(writes).toBe(2);
});

test("retries a quota failure exactly once", () => {
  const storage = makeStorage();
  let writes = 0;
  const originalSetItem = storage.setItem.bind(storage);
  jest.spyOn(storage, "setItem").mockImplementation((key, value) => {
    writes += 1;
    if (writes === 1) throw quotaError();
    originalSetItem(key, value);
  });

  writeVm0007Storage(storage, "a6:vm0007-gap-report-audit:v1:retry", "value", "retry");
  expect(writes).toBe(2);
  expect(storage.getItem("a6:vm0007-gap-report-audit:v1:retry")).toBe("value");
});

test("retains exactly three complete pairs after saving the fourth, including the newest pair", () => {
  const storage = makeStorage();
  seedPair(storage, "pair-1", "2026-01-01T00:00:00.000Z");
  seedPair(storage, "pair-2", "2026-01-02T00:00:00.000Z");
  seedPair(storage, "pair-3", "2026-01-03T00:00:00.000Z");
  writeVm0007Storage(storage, `${VM0007_GAP_REPORT_AUDIT_PREFIX}pair-4`, JSON.stringify({ generatedAt: "2026-01-04T00:00:00.000Z" }), "pair-4");
  writeVm0007Storage(storage, `${VM0007_EVIDENCE_MAP_DRAFT_PREFIX}pair-4`, JSON.stringify({ generatedAt: "2026-01-04T00:00:00.000Z" }), "pair-4");

  const completeIds = ["pair-1", "pair-2", "pair-3", "pair-4"].filter((auditId) => storage.getItem(`${VM0007_GAP_REPORT_AUDIT_PREFIX}${auditId}`) && storage.getItem(`${VM0007_EVIDENCE_MAP_DRAFT_PREFIX}${auditId}`));
  expect(completeIds).toEqual(["pair-2", "pair-3", "pair-4"]);
});

test("progressively evicts the oldest eligible pairs until a quota retry succeeds", () => {
  const storage = makeStorage();
  seedPair(storage, "old-1", "2026-01-01T00:00:00.000Z");
  seedPair(storage, "old-2", "2026-01-02T00:00:00.000Z");
  seedPair(storage, "old-3", "2026-01-03T00:00:00.000Z");
  seedPair(storage, "new-1", "2026-01-04T00:00:00.000Z");
  let writes = 0;
  const originalSetItem = storage.setItem.bind(storage);
  jest.spyOn(storage, "setItem").mockImplementation((key, value) => {
    writes += 1;
    if (writes < 4) throw quotaError();
    originalSetItem(key, value);
  });

  writeVm0007Storage(storage, `${VM0007_GAP_REPORT_AUDIT_PREFIX}current`, "large-audit", "current");

  for (const auditId of ["old-1", "old-2", "old-3"]) {
    expect(storage.getItem(`${VM0007_GAP_REPORT_AUDIT_PREFIX}${auditId}`)).toBeNull();
    expect(storage.getItem(`${VM0007_EVIDENCE_MAP_DRAFT_PREFIX}${auditId}`)).toBeNull();
  }
  expect(storage.getItem(`${VM0007_GAP_REPORT_AUDIT_PREFIX}new-1`)).not.toBeNull();
  expect(storage.getItem(`${VM0007_GAP_REPORT_AUDIT_PREFIX}current`)).toBe("large-audit");
  expect(writes).toBe(4);
});

test("returns storage_write_failed when the retry also fails", () => {
  const storage = makeStorage();
  const setItem = jest.spyOn(storage, "setItem").mockImplementation(() => { throw quotaError(); });

  try {
    writeVm0007Storage(storage, "a6:vm0007-gap-report-audit:v1:failed", "value", "failed");
    throw new Error("expected write to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(Vm0007StorageWriteError);
    expect((error as Vm0007StorageWriteError).code).toBe("storage_write_failed");
  }
  expect(setItem).toHaveBeenCalledTimes(2);
});
