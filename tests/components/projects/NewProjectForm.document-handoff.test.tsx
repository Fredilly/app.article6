/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createRoot } from "react-dom/client";
import { putAttachmentBytes } from "@/lib/proofMap/attachments";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: () => new URLSearchParams("handoff=document-metadata"),
}));

const NewProjectForm = require("@/components/projects/NewProjectForm")
  .default as typeof import("@/components/projects/NewProjectForm").default;

describe("NewProjectForm document handoff", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const originalFetch = global.fetch;

  function asArrayBuffer(value: Uint8Array): ArrayBuffer {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    pushMock.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      "article6:pending-project-document-draft",
      JSON.stringify({
        source: {
          origin: "quick-check",
          evidenceId: "ev-1",
          attachmentId: "att-1",
          fileName: "plum-project-pdd.pdf",
          mimeType: "application/pdf",
          contentSha256: "sha-att-1",
          extractedAt: "2026-05-27T00:00:00.000Z",
        },
        fields: {
          projectTitle: {
            key: "projectTitle",
            label: "Project Title",
            value: "PLUM Project",
            confidence: "high",
            provenance: { fileName: "plum-project-pdd.pdf", page: 1, excerpt: "PLUM Project" },
          },
          country: {
            key: "country",
            label: "Country",
            value: "Malawi",
            confidence: "medium",
            provenance: { fileName: "plum-project-pdd.pdf", page: 1, excerpt: "Malawi" },
          },
          projectId: {
            key: "projectId",
            label: "Registry / Project ID",
            value: "VCS-1530",
            confidence: "high",
            provenance: { fileName: "plum-project-pdd.pdf", page: 1, excerpt: "VCS-1530" },
          },
          methodology: {
            key: "methodology",
            label: "Methodology",
            value: "AR-ACM0003",
            confidence: "high",
            provenance: { fileName: "plum-project-pdd.pdf", page: 2, excerpt: "AR-ACM0003" },
          },
          standard: {
            key: "standard",
            label: "Standard",
            value: "VCS Standard",
            confidence: "medium",
            provenance: { fileName: "plum-project-pdd.pdf", page: 1, excerpt: "VCS Standard" },
          },
          proponent: {
            key: "proponent",
            label: "Proponent",
            value: "Article6 Climate",
            confidence: "medium",
            provenance: { fileName: "plum-project-pdd.pdf", page: 1, excerpt: "Article6 Climate" },
          },
          documentType: {
            key: "documentType",
            label: "Document Type",
            value: "Project Design Document",
            confidence: "high",
            provenance: { fileName: "plum-project-pdd.pdf", page: 1, excerpt: "Project Design Document" },
          },
          version: {
            key: "version",
            label: "Version",
            value: "v1",
            confidence: "low",
            provenance: { fileName: "plum-project-pdd.pdf", page: 1, excerpt: "v1" },
          },
          documentDate: {
            key: "documentDate",
            label: "Document Date",
            value: "2026-05-01",
            confidence: "medium",
            provenance: { fileName: "plum-project-pdd.pdf", page: 1, excerpt: "2026-05-01" },
          },
        },
        suggestedExistingProjects: [],
      }),
    );
    await putAttachmentBytes("att-1", asArrayBuffer(new TextEncoder().encode("PLUM Project source document bytes")));

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/projects/methods") {
        return new Response(JSON.stringify({
          methods: [
            { code: "AR-ACM0003", program: "UNFCCC/Forestry", version: "v02-0", ruleCount: 2 },
          ],
        }), { status: 200 });
      }
      if (url === "/api/projects/method-rules?code=AR-ACM0003&version=v02-0") {
        return new Response(JSON.stringify({
          rules: [
            { id: "R-1-0001", title: "Monitoring frequency", sectionId: "S-1" },
            { id: "R-1-0002", title: "Boundary consistency", sectionId: "S-2" },
          ],
        }), { status: 200 });
      }
      throw new Error(`Unhandled fetch ${url}`);
    }) as typeof fetch;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
    window.sessionStorage.clear();
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete (global as { fetch?: typeof fetch }).fetch;
    }
  });

  it("creates a readiness workspace from detected project details", async () => {
    await act(async () => {
      root.render(<NewProjectForm />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Confirm Project Details");
    expect(container.textContent).toContain("PLUM Project");
    expect(container.textContent).toContain("AR-ACM0003");

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    await act(async () => {
      checkbox!.click();
    });

    const submitButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Create Readiness Workspace"),
    ) as HTMLButtonElement | undefined;
    expect(submitButton).toBeDefined();
    expect(submitButton?.disabled).toBe(false);

    await act(async () => {
      submitButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    const href = pushMock.mock.calls[0]?.[0] ?? "";
    expect(href).toContain("/m/AR-ACM0003/v/v02-0?");
    expect(href).toContain("projectId=");
    expect(href).toContain("workspaceId=");
    expect(href).toContain("tab=verify");
    expect(window.sessionStorage.getItem("article6:pending-project-document-draft")).toBeNull();
  });
});
