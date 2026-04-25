import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { EvidenceSnapshot } from "@/lib/proofMap/evidenceSnapshot";

const buildAuditPackZip = jest.fn();

jest.mock("@/exports/auditPack", () => ({
  buildAuditPackZip: (...args: unknown[]) => buildAuditPackZip(...args),
}));

describe("audit-pack route", () => {
  beforeEach(() => {
    buildAuditPackZip.mockReset();
    buildAuditPackZip.mockReturnValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
  });

  test("POST returns 400 when method/version is missing", async () => {
    const { POST } = await import("@/app/api/exports/audit-pack/route");
    const res = await POST(
      new Request("http://localhost/api/exports/audit-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "AR-ACM0003" }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toContain("Missing method/version");
    expect(buildAuditPackZip).not.toHaveBeenCalled();
  });

  test("POST returns 400 for malformed artifact payloads", async () => {
    const { POST } = await import("@/app/api/exports/audit-pack/route");
    const res = await POST(
      new Request("http://localhost/api/exports/audit-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "AR-ACM0003",
          version: "v02-0",
          artifact: { method: { code: "", version: "v02-0" } },
        }),
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toContain("Invalid artifact payload");
    expect(buildAuditPackZip).not.toHaveBeenCalled();
  });

  test("POST exports zip for valid finalized payloads", async () => {
    const artifact: EvidenceSnapshot = {
      method: { code: "AR-ACM0003", version: "v02-0" },
      evidence_source: { type: "stac_url", ref: "https://stac.example.test" },
      verifier: {
        runId: "run-1",
        createdAt: "2026-04-24T11:50:00.000Z",
        minutes: "Reviewed.",
        outcomeNote: "Ready.",
        finalizedAt: "2026-04-24T12:00:00.000Z",
        finalizedState: "finalized",
        delta: "",
        impact: "",
        tasks: [],
      },
    };

    const { POST } = await import("@/app/api/exports/audit-pack/route");
    const res = await POST(
      new Request("http://localhost/api/exports/audit-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "AR-ACM0003",
          version: "v02-0",
          artifact,
          evidencePins: [{ id: "pin-1", kind: "note", title: "scene-1", created_at: "2026-04-24T11:54:00.000Z" }],
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(buildAuditPackZip).toHaveBeenCalledWith("AR-ACM0003", "v02-0", {
      finalizedReview: {
        artifact,
        evidencePins: [{ id: "pin-1", kind: "note", title: "scene-1", created_at: "2026-04-24T11:54:00.000Z" }],
      },
    });
  });

  test("POST keeps unexpected export failures as 500", async () => {
    buildAuditPackZip.mockImplementation(() => {
      throw new Error("zip failed");
    });
    const { POST } = await import("@/app/api/exports/audit-pack/route");
    const res = await POST(
      new Request("http://localhost/api/exports/audit-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "AR-ACM0003", version: "v02-0" }),
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.text()).resolves.toContain("zip failed");
  });

  test("GET still returns 400 when method/version is missing", async () => {
    const { GET } = await import("@/app/api/exports/audit-pack/route");
    const res = await GET(new Request("http://localhost/api/exports/audit-pack"));

    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toContain("Missing ?method");
  });
});
