import { beforeEach, describe, expect, it } from "@jest/globals";
import {
  ensureReviewWorkspace,
  findReviewWorkspaceByProjectAndMethod,
  listReviewWorkspacesForProject,
} from "@/lib/reviewWorkspaces/storage";

let store: Record<string, string> = {};

describe("review workspace storage", () => {
  beforeEach(() => {
    const localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorage,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "window", {
      value: { localStorage },
      configurable: true,
      writable: true,
    });
    globalThis.localStorage.clear();
  });

  it("creates and reuses one workspace per project-method-version pair", () => {
    const created = ensureReviewWorkspace({
      projectId: "proj_1",
      projectName: "Liwonde REDD+",
      projectCode: "VCS-1530",
      methodCode: "AR-ACM0003",
      methodVersion: "v02-0",
      reportingPeriod: "2024",
    });
    const reused = ensureReviewWorkspace({
      projectId: "proj_1",
      projectName: "Liwonde REDD+",
      projectCode: "VCS-1530",
      methodCode: "AR-ACM0003",
      methodVersion: "v02-0",
      reportingPeriod: "2024",
    });

    expect(reused.id).toBe(created.id);
    expect(reused.name).toContain("Liwonde REDD+");
    expect(listReviewWorkspacesForProject("proj_1")).toHaveLength(1);
    expect(findReviewWorkspaceByProjectAndMethod("proj_1", "AR-ACM0003", "v02-0")?.id).toBe(created.id);
  });
});
