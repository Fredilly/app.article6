/** @jest-environment jsdom */

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { EvidencePin } from "@/lib/proofMap/types";
import { saveReview } from "@/lib/verify/reviewStore";
import { createVerifierRunBundle, persistVerifierRunBundle } from "@/lib/verify/runState";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const TrustStrip = require("@/components/TrustStrip").default as typeof import("@/components/TrustStrip").default;

const provenanceJson = {
  generated_at: "2026-04-22T10:00:00Z",
  generatedAt: "2026-04-22T10:00:00Z",
  repo: "Fredilly/app.article6",
  sha: "1234567890abcdef1234567890abcdef12345678",
};

describe("TrustStrip", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    localStorage.clear();
    document.body.innerHTML = "";
  });

  it("renders a truthful Methods surface without using provenance as last-reviewed state", () => {
    const html = renderToStaticMarkup(
      <TrustStrip
        methodCode="UNFCCC.Forestry.AR-ACM0003"
        version="02.0"
        provenanceJson={provenanceJson}
        surface="methods"
      />,
    );

    expect(html).toContain("Download verification pack");
    expect(html).toContain("Last reviewed");
    expect(html).toContain("Not reviewed yet");
    expect(html).not.toContain("Apr 22, 2026");
    expect(html).not.toContain("Trust strip");
    expect(html).not.toContain("Derived");
    expect(html).not.toContain("Advanced");
  });

  it("POSTs current browser review state for Method Review exports", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-04-25T12:05:00.000Z"));
    saveReview({
      ruleId: "R-1",
      methodology: "AR-ACM0003",
      version: "v02-0",
      status: "verified",
      rationale: "Satellite evidence matches the monitoring period.",
      supportReference: "scene-1",
      evidenceLink: "scene-1",
      evidenceAttachments: [],
      reviewedBy: "Verifier A",
      reviewedAt: "2026-04-25T12:00:00.000Z",
      updatedAt: "2026-04-25T12:00:00.000Z",
    });
    const bundle = createVerifierRunBundle("AR-ACM0003", "v02-0");
    persistVerifierRunBundle("AR-ACM0003", "v02-0", {
      ...bundle,
      savedReviewerArtifactAt: "2026-04-25T12:05:00.000Z",
      minutes: "Reviewer minutes",
      outcomeNote: "Draft outcome note",
      savedReviewerArtifactContext: {
        methodCode: "AR-ACM0003",
        version: "v02-0",
        ruleId: "R-1",
        runId: bundle.runContext.runId,
      },
    });

    const evidencePins: EvidencePin[] = [
      {
        id: "pin-1",
        kind: "note",
        title: "scene-1",
        ruleId: "R-1",
        itemId: "scene-1",
        cited_ids: ["R-1"],
        stac_item_ids: ["scene-1"],
        created_at: "2026-04-25T11:59:00.000Z",
      },
    ];

    const fetchMock = jest.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:audit-pack") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
    jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:audit-pack");
    jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TrustStrip
          methodCode="AR-ACM0003"
          version="v02-0"
          provenanceJson={provenanceJson}
          surface="methods"
          methodReviewEvidencePins={evidencePins}
        />,
      );
    });

    await act(async () => {
      const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((candidate) =>
        candidate.textContent?.includes("Download verification pack"),
      );
      button?.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/exports/audit-pack",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.any(String),
      }),
    );

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      method: string;
      version: string;
      currentReview: {
        latestReviewAt: string | null;
        reviews: Array<{ ruleId: string; rationale: string }>;
        verifierBundle: { outcomeNote: string; savedReviewerArtifactAt: string | null };
        evidencePins: EvidencePin[];
      };
    };
    expect(body.method).toBe("AR-ACM0003");
    expect(body.version).toBe("v02-0");
    expect(body.currentReview.latestReviewAt).toBe("2026-04-25T12:05:00.000Z");
    expect(body.currentReview.reviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "R-1",
          rationale: "Satellite evidence matches the monitoring period.",
        }),
      ]),
    );
    expect(body.currentReview.verifierBundle.outcomeNote).toBe("Draft outcome note");
    expect(body.currentReview.verifierBundle.savedReviewerArtifactAt).toBe("2026-04-25T12:05:00.000Z");
    expect(body.currentReview.evidencePins).toEqual(evidencePins);

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps the default trust surface unchanged elsewhere", () => {
    const html = renderToStaticMarkup(
      <TrustStrip
        methodCode="UNFCCC.Forestry.AR-ACM0003"
        version="02.0"
        provenanceJson={provenanceJson}
      />,
    );

    expect(html).toContain("Trust strip");
    expect(html).toContain("Derived");
    expect(html).toContain("Advanced");
    expect(html).toContain("Download verification pack");
  });
});
