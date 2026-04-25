import { describe, expect, test } from "@jest/globals";
import { finalizedArtifactMatchesContext, finalizedArtifactRuleId } from "@/components/map/ProofMapTab";
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

describe("ProofMapTab finalized review artifact guard", () => {
  test("extracts the finalized rule id from the strongest available context", () => {
    expect(finalizedArtifactRuleId(buildArtifact())).toBe("R-1");
    expect(
      finalizedArtifactRuleId(
        buildArtifact({
          summary: undefined,
          outcome: {
            aoi: { hash: "aoi", bbox: [0, 0, 1, 1], areaKm2: 1 },
            stac: { query: { source: "https://stac.example.test" }, itemIds: ["scene-1"] },
            linkage: { selectedRuleId: "R-2", linkedRuleIds: ["R-2"] },
            exportState: { snapshotExportedAt: "2026-03-25T00:10:00Z" },
            provenance: {
              methodCode: "AR-ACM0003",
              version: "v02-0",
              generatedAt: "2026-03-25T00:10:00Z",
              snapshotSchemaVersion: "evidence-snapshot/v2",
            },
          },
        }),
      ),
    ).toBe("R-2");
  });

  test("matches only the current finalized method/version/rule/run/timestamp context", () => {
    const artifact = buildArtifact();
    expect(
      finalizedArtifactMatchesContext({
        artifact,
        methodCode: "AR-ACM0003",
        version: "v02-0",
        selectedRuleId: "R-1",
        runId: "run-1234",
        finalizedAt: "2026-03-25T00:10:00Z",
      }),
    ).toBe(true);

    expect(
      finalizedArtifactMatchesContext({
        artifact,
        methodCode: "AR-ACM9999",
        version: "v02-0",
        selectedRuleId: "R-1",
        runId: "run-1234",
        finalizedAt: "2026-03-25T00:10:00Z",
      }),
    ).toBe(false);
    expect(
      finalizedArtifactMatchesContext({
        artifact,
        methodCode: "AR-ACM0003",
        version: "v99-9",
        selectedRuleId: "R-1",
        runId: "run-1234",
        finalizedAt: "2026-03-25T00:10:00Z",
      }),
    ).toBe(false);
    expect(
      finalizedArtifactMatchesContext({
        artifact,
        methodCode: "AR-ACM0003",
        version: "v02-0",
        selectedRuleId: "R-2",
        runId: "run-1234",
        finalizedAt: "2026-03-25T00:10:00Z",
      }),
    ).toBe(false);
    expect(
      finalizedArtifactMatchesContext({
        artifact,
        methodCode: "AR-ACM0003",
        version: "v02-0",
        selectedRuleId: "R-1",
        runId: "run-9999",
        finalizedAt: "2026-03-25T00:10:00Z",
      }),
    ).toBe(false);
    expect(
      finalizedArtifactMatchesContext({
        artifact,
        methodCode: "AR-ACM0003",
        version: "v02-0",
        selectedRuleId: "R-1",
        runId: "run-1234",
        finalizedAt: "2026-03-26T00:10:00Z",
      }),
    ).toBe(false);
    expect(
      finalizedArtifactMatchesContext({
        artifact: buildArtifact({
          verifier: {
            ...artifact.verifier,
            finalizedState: "draft",
          },
        }),
        methodCode: "AR-ACM0003",
        version: "v02-0",
        selectedRuleId: "R-1",
        runId: "run-1234",
        finalizedAt: "2026-03-25T00:10:00Z",
      }),
    ).toBe(false);
  });
});
