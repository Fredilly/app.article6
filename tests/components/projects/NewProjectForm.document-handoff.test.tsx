/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { createRoot } from "react-dom/client";
import { stagePendingProjectDocumentDraft } from "@/lib/projects/documentMetadata";
import { createProject } from "@/lib/projects/storage";

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

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    pushMock.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
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

  it("prefills extracted fields and requires confirmation before creation", async () => {
    stagePendingProjectDocumentDraft({
      source: {
        origin: "quick-check",
        evidenceId: "ev-pdd-1",
        attachmentId: "att-pdd-1",
        fileName: "demo-pdd.pdf",
        mimeType: "application/pdf",
        contentSha256: "sha-demo",
        extractedAt: "2026-05-24T00:00:00.000Z",
      },
      fields: {
        projectTitle: {
          key: "projectTitle",
          label: "Project Title",
          value: "Malawi Demo Project",
          confidence: "high",
          provenance: null,
        },
        country: {
          key: "country",
          label: "Country",
          value: "Malawi",
          confidence: "high",
          provenance: null,
        },
        projectId: {
          key: "projectId",
          label: "Registry / Project ID",
          value: "VCS-1530",
          confidence: "high",
          provenance: null,
        },
        methodology: {
          key: "methodology",
          label: "Methodology",
          value: "VM0007",
          confidence: "medium",
          provenance: null,
        },
        standard: {
          key: "standard",
          label: "Standard",
          value: "VCS Standard v4.7",
          confidence: "medium",
          provenance: null,
        },
        proponent: {
          key: "proponent",
          label: "Proponent",
          value: "Article6 Climate",
          confidence: "high",
          provenance: null,
        },
        documentType: {
          key: "documentType",
          label: "Document Type",
          value: "Project Design Document",
          confidence: "high",
          provenance: null,
        },
        version: {
          key: "version",
          label: "Version",
          value: "v1.0",
          confidence: "medium",
          provenance: null,
        },
        documentDate: {
          key: "documentDate",
          label: "Document Date",
          value: "2026-05-24",
          confidence: "medium",
          provenance: null,
        },
      },
      suggestedExistingProjects: [],
    });

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/projects/methods") {
        return new Response(JSON.stringify({ methods: [] }), { status: 200 });
      }
      throw new Error(`Unhandled fetch ${url}`);
    }) as typeof fetch;

    await act(async () => {
      root.render(<NewProjectForm />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const titleInput = Array.from(container.querySelectorAll("input")).find(
      (input) => (input as HTMLInputElement).value === "Malawi Demo Project",
    ) as HTMLInputElement | undefined;
    expect(titleInput?.value).toBe("Malawi Demo Project");
    expect(container.textContent).toContain("We found a project");
    expect(container.textContent).toContain("Review detected details");

    const manualReviewButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) =>
      button.textContent?.includes("Continue without a linked method"),
    ) as HTMLButtonElement | undefined;
    expect(manualReviewButton).toBeDefined();
    await act(async () => {
      manualReviewButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    const submitButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Start Review"),
    ) as HTMLButtonElement | undefined;
    expect(submitButton).toBeDefined();
    expect(submitButton?.disabled).toBe(true);

    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    await act(async () => {
      checkbox!.click();
    });

    expect(submitButton?.disabled).toBe(false);

    await act(async () => {
      submitButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(String(pushMock.mock.calls[0]?.[0] ?? "")).toContain("/projects/");
  });

  it("allows attaching to an existing project without requiring a new project name", async () => {
    const existingProject = createProject({
      name: "Existing Review Workspace",
      reviewMode: "manual",
    });

    stagePendingProjectDocumentDraft({
      source: {
        origin: "quick-check",
        evidenceId: "ev-pdd-2",
        attachmentId: "att-pdd-2",
        fileName: "demo-pdd.pdf",
        mimeType: "application/pdf",
        contentSha256: "sha-demo-2",
        extractedAt: "2026-05-24T00:00:00.000Z",
      },
      fields: {
        projectTitle: {
          key: "projectTitle",
          label: "Project Title",
          value: "Detected New Name",
          confidence: "high",
          provenance: null,
        },
        country: {
          key: "country",
          label: "Country",
          value: "Malawi",
          confidence: "high",
          provenance: null,
        },
        projectId: {
          key: "projectId",
          label: "Registry / Project ID",
          value: "VCS-1530",
          confidence: "high",
          provenance: null,
        },
        methodology: {
          key: "methodology",
          label: "Methodology",
          value: "VM0007",
          confidence: "medium",
          provenance: null,
        },
        standard: {
          key: "standard",
          label: "Standard",
          value: "VCS Standard v4.7",
          confidence: "medium",
          provenance: null,
        },
        proponent: {
          key: "proponent",
          label: "Proponent",
          value: "Article6 Climate",
          confidence: "high",
          provenance: null,
        },
        documentType: {
          key: "documentType",
          label: "Document Type",
          value: "Project Design Document",
          confidence: "high",
          provenance: null,
        },
        version: {
          key: "version",
          label: "Version",
          value: "v1.0",
          confidence: "medium",
          provenance: null,
        },
        documentDate: {
          key: "documentDate",
          label: "Document Date",
          value: "2026-05-24",
          confidence: "medium",
          provenance: null,
        },
      },
      suggestedExistingProjects: [
        {
          projectId: existingProject.id,
          projectName: existingProject.name,
          projectCode: existingProject.projectCode,
          confidence: "high",
          score: 0.98,
          matchReasons: ["Matching project title"],
        },
      ],
    });

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/projects/methods") {
        return new Response(JSON.stringify({ methods: [] }), { status: 200 });
      }
      throw new Error(`Unhandled fetch ${url}`);
    }) as typeof fetch;

    await act(async () => {
      root.render(<NewProjectForm />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const attachButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Attach to existing project"),
    ) as HTMLButtonElement | undefined;
    expect(attachButton).toBeDefined();
    await act(async () => {
      attachButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("No new project name is required.");
    expect(container.querySelector("input[required]")).toBeNull();

    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    await act(async () => {
      checkbox!.click();
    });

    const submitButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Continue with this document"),
    ) as HTMLButtonElement | undefined;
    expect(submitButton).toBeDefined();
    expect(submitButton?.disabled).toBe(false);

    await act(async () => {
      submitButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(pushMock).toHaveBeenCalledWith(`/projects/${existingProject.id}`);
  });
});
