/** @jest-environment jsdom */

import { describe, expect, it, jest } from "@jest/globals";
import { resolveQuickCheckCandidate, resolveQuickCheckCandidates } from "@/lib/chat/quickCheckResolver";

describe("quick check requirement resolver", () => {
  const methods = [
    { code: "AR-ACM0003", latestVersion: "v02-0", versions: ["v02-0"] },
    { code: "AR-AMS0007", latestVersion: "v01-0", versions: ["v01-0"] },
  ];

  it("returns the canonical rule entity for a valid reference", async () => {
    const loadRules = jest.fn(async () => [
      { id: "R-1-0001", title: "Monitoring frequency", snippet: "Maintain a monitoring report.", tags: [] },
    ]);

    const resolved = await resolveQuickCheckCandidate({
      candidate: {
        key: "AR-ACM0003@@v02-0@@R-1-0001",
        methodologyId: "AR-ACM0003",
        methodologyVersion: "v02-0",
        requirementId: "R-1-0001",
        requirementLabel: "stale label",
        score: 0.91,
      },
      methods,
      loadRules,
    });

    expect(resolved?.methodologyLabel).toBe("AR-ACM0003 · v02-0");
    expect(resolved?.requirementLabel).toBe("R-1-0001 · Monitoring frequency");
    expect(resolved?.rule.id).toBe("R-1-0001");
  });

  it("fails safely for unresolved references", async () => {
    const loadRules = jest.fn(async () => [
      { id: "R-1-0001", title: "Monitoring frequency", snippet: "Maintain a monitoring report.", tags: [] },
    ]);

    await expect(
      resolveQuickCheckCandidate({
        candidate: {
          key: "AR-ACM0003@@v02-0@@R-9-9999",
          methodologyId: "AR-ACM0003",
          methodologyVersion: "v02-0",
          requirementId: "R-9-9999",
          requirementLabel: "broken",
          score: 0.99,
        },
        methods,
        loadRules,
      }),
    ).resolves.toBeNull();

    await expect(
      resolveQuickCheckCandidate({
        candidate: {
          key: "AR-ACM0003@@v99-0@@R-1-0001",
          methodologyId: "AR-ACM0003",
          methodologyVersion: "v99-0",
          requirementId: "R-1-0001",
          requirementLabel: "broken version",
          score: 0.99,
        },
        methods,
        loadRules,
      }),
    ).resolves.toBeNull();
  });

  it("filters unresolved candidates while preserving valid ones", async () => {
    const loadRules = jest.fn(async () => [
      { id: "R-1-0001", title: "Monitoring frequency", snippet: "Maintain a monitoring report.", tags: [] },
      { id: "R-1-0002", title: "Boundary consistency", snippet: "Boundary description aligns to the mapped area.", tags: [] },
    ]);

    const resolved = await resolveQuickCheckCandidates({
      candidates: [
        {
          key: "AR-ACM0003@@v02-0@@R-9-9999",
          methodologyId: "AR-ACM0003",
          methodologyVersion: "v02-0",
          requirementId: "R-9-9999",
          requirementLabel: "broken",
          score: 0.99,
        },
        {
          key: "AR-ACM0003@@v02-0@@R-1-0002",
          methodologyId: "AR-ACM0003",
          methodologyVersion: "v02-0",
          requirementId: "R-1-0002",
          requirementLabel: "candidate",
          score: 0.88,
        },
      ],
      methods,
      loadRules,
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.requirementId).toBe("R-1-0002");
  });
});
