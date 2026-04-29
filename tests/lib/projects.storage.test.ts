/** @jest-environment jsdom */

import { beforeEach, describe, expect, it } from "@jest/globals";
import { createProject, getProject, listProjects, updateProjectEvidenceIntake } from "@/lib/projects/storage";

describe("project storage evidence intake foundation", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("initializes each new project with the three core evidence intake sources marked as not supplied", () => {
    const project = createProject({
      name: "Malawi grouped activity",
      methodCode: "AR-ACM0003",
      methodVersion: "v02-0",
      ruleIds: [{ id: "R-1", title: "Rule 1", sectionId: "S-1" }],
    });

    expect(project.evidenceIntake).toEqual([
      { type: "pdd", label: "PDD", status: "source-not-supplied" },
      { type: "monitoring-report", label: "Monitoring report", status: "source-not-supplied" },
      { type: "workbook", label: "Workbook", status: "source-not-supplied" },
    ]);
  });

  it("updates evidence intake source status and provenance for an in-progress project", () => {
    const project = createProject({
      name: "Malawi grouped activity",
      methodCode: "AR-ACM0003",
      methodVersion: "v02-0",
      ruleIds: [{ id: "R-1", title: "Rule 1", sectionId: "S-1" }],
    });

    const updated = updateProjectEvidenceIntake(project.id, "pdd", {
      status: "supplied",
      sourceName: "project-design.pdf",
      provenanceNote: "Boundary description and coordinates expected from uploaded PDD.",
    });

    expect(updated?.evidenceIntake.find((item) => item.type === "pdd")).toMatchObject({
      type: "pdd",
      label: "PDD",
      status: "supplied",
      sourceName: "project-design.pdf",
      provenanceNote: "Boundary description and coordinates expected from uploaded PDD.",
    });
  });

  it("normalizes older stored projects that predate the evidence intake register", () => {
    window.localStorage.setItem(
      "article6_projects",
      JSON.stringify([
        {
          id: "proj_legacy",
          name: "Legacy project",
          methodCode: "AR-ACM0003",
          methodVersion: "v02-0",
          status: "in-progress",
          createdAt: "2026-04-29T00:00:00.000Z",
          reviews: [{ ruleId: "R-1", ruleTitle: "Rule 1", sectionId: "S-1", status: "not-started", evidenceIds: [] }],
        },
      ]),
    );

    const project = getProject("proj_legacy");
    expect(project?.evidenceIntake).toEqual([
      { type: "pdd", label: "PDD", status: "source-not-supplied" },
      { type: "monitoring-report", label: "Monitoring report", status: "source-not-supplied" },
      { type: "workbook", label: "Workbook", status: "source-not-supplied" },
    ]);
    expect(listProjects()[0]?.evidenceIntake[0]?.type).toBe("pdd");
  });
});
