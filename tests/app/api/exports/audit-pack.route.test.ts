import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET, POST } from "@/app/api/exports/audit-pack/route";
import type { EvidenceSnapshot } from "@/lib/proofMap/evidenceSnapshot";

function buildArtifact(overrides?: Partial<EvidenceSnapshot>): EvidenceSnapshot {
  const artifact: EvidenceSnapshot = {
    method: { code: "AR-ACM0003", version: "v02-0" },
    evidence_source: { type: "stac_url", ref: "https://stac.example.test" },
    selected: {
      id: "scene-1",
      item: {
        id: "scene-1",
        datetime: "2026-03-25T00:00:00Z",
        collection: "sentinel-2",
        cloud_cover: 4,
        linked_rules: ["R-1"],
      },
    },
    outcome: {
      aoi: { hash: "aoi", bbox: [0, 0, 1, 1], areaKm2: 1 },
      stac: { query: { source: "https://stac.example.test" }, itemIds: ["scene-1"] },
      linkage: { selectedRuleId: "R-1", linkedRuleIds: ["R-1"] },
      exportState: { snapshotExportedAt: "2026-03-25T00:10:00Z" },
      provenance: {
        methodCode: "AR-ACM0003",
        version: "v02-0",
        generatedAt: "2026-03-25T00:10:00Z",
        snapshotSchemaVersion: "evidence-snapshot/v2",
      },
    },
    verifier: {
      runId: "run-1234",
      createdAt: "2026-03-25T00:05:00Z",
      minutes: "minutes",
      outcomeNote: "note",
      finalizedAt: "2026-03-25T00:10:00Z",
      finalizedState: "finalized",
      delta: "",
      impact: "",
      checklistStatus: "1/1 completed",
      checklist: [],
      tasks: [],
    },
    kpis: {
      stacSearchResultCount: 1,
      selectedEvidenceCount: 1,
      linkedRuleCount: 1,
      coverage: { numerator: 1, denominator: 1 },
      snapshotExportedAt: "2026-03-25T00:10:00Z",
    },
    summary: {
      methodCode: "AR-ACM0003",
      version: "v02-0",
      ruleId: "R-1",
      ruleSection: "Monitoring period",
      ruleText: "Evidence must fall inside the monitoring period.",
      selectedEvidenceId: "scene-1",
      selectedEvidenceDatetime: "2026-03-25T00:00:00Z",
      cloudCover: 4,
      aoiLabel: "Project AOI",
      reviewState: "finalized",
      generatedAt: "2026-03-25T00:10:00Z",
      outcomeNote: "Stable result.",
      stacSearchResultCount: 1,
      linkedRuleCount: 1,
      selectedEvidenceLinkedRules: ["R-1"],
      checklistStatus: "1/1 completed",
      reconciliationStatus: "Supported",
      reconciliationReason: "All expected evidence is linked.",
      narrative: "Finalized verify review.",
    },
  };
  return { ...artifact, ...overrides };
}

const rulesJson = {
  rules: [{ id: "R-1", text: "Evidence must fall inside the monitoring period." }],
};

const sectionsJson = {
  sections: [{ id: "S-1", title: "Monitoring", anchor: "#S-1" }],
};

function withTemporaryMethodologyCheckout<T>(callback: () => Promise<T> | T): Promise<T> | T {
  const previousCwd = process.cwd();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "article6-audit-pack-route-"));
  const methodDir = path.join(root, "public", "methodologies", "UNFCCC", "Forestry", "AR-ACM0003", "v02-0");

  fs.mkdirSync(methodDir, { recursive: true });
  fs.writeFileSync(
    path.join(methodDir, "META.json"),
    JSON.stringify({ code: "AR-ACM0003", version: "v02-0", title: "Temporary test methodology" }),
  );
  fs.writeFileSync(path.join(methodDir, "rules.json"), JSON.stringify(rulesJson));
  fs.writeFileSync(path.join(methodDir, "sections.json"), JSON.stringify(sectionsJson));
  fs.writeFileSync(path.join(methodDir, "rules.rich.json"), JSON.stringify(rulesJson));
  fs.writeFileSync(path.join(methodDir, "sections.rich.json"), JSON.stringify(sectionsJson));

  try {
    process.chdir(root);
    return callback();
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe("/api/exports/audit-pack route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("GET rejects missing method/version", async () => {
    const response = await GET(new Request("http://localhost/api/exports/audit-pack"));

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Missing ?method=AR-XXXX&version=vYY-Y");
  });

  it("POST rejects missing method/version", async () => {
    const response = await POST(
      new Request("http://localhost/api/exports/audit-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Missing method/version in request body");
  });

  it("POST rejects malformed artifact payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/exports/audit-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "AR-ACM0003",
          version: "v02-0",
          artifact: { invalid: true },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Invalid artifact payload");
  });

  it("POST rejects wrong method and wrong version artifacts", async () => {
    const wrongMethod = await POST(
      new Request("http://localhost/api/exports/audit-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "AR-OTHER",
          version: "v02-0",
          artifact: buildArtifact(),
        }),
      }),
    );
    expect(wrongMethod.status).toBe(400);
    expect(await wrongMethod.text()).toContain("Artifact method does not match request method");

    const wrongVersion = await POST(
      new Request("http://localhost/api/exports/audit-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "AR-ACM0003",
          version: "v99-9",
          artifact: buildArtifact(),
        }),
      }),
    );
    expect(wrongVersion.status).toBe(400);
    expect(await wrongVersion.text()).toContain("Artifact version does not match request version");
  });

  it("POST rejects draft artifacts", async () => {
    const response = await POST(
      new Request("http://localhost/api/exports/audit-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "AR-ACM0003",
          version: "v02-0",
          artifact: buildArtifact({
            verifier: {
              ...buildArtifact().verifier,
              finalizedState: "draft",
              finalizedAt: null,
            },
          }),
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Artifact must be explicitly finalized");
  });

  it("POST exports matching finalized artifacts", async () => {
    const artifact = buildArtifact();
    const evidencePins = [{ id: "pin-1", kind: "note", title: "scene-1", cited_ids: [], created_at: "2026-03-25T00:00:00Z" }];
    const response = await withTemporaryMethodologyCheckout(() =>
      POST(
        new Request("http://localhost/api/exports/audit-pack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: "AR-ACM0003",
            version: "v02-0",
            artifact,
            evidencePins,
          }),
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
  });
});
