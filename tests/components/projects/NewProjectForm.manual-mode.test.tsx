/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createRoot } from "react-dom/client";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams("mode=manual"),
}));

const NewProjectForm = require("@/components/projects/NewProjectForm")
  .default as typeof import("@/components/projects/NewProjectForm").default;

describe("NewProjectForm manual mode", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    window.sessionStorage.clear();
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/projects/methods") {
        return new Response(JSON.stringify({ methods: [] }), { status: 200 });
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

  it("renders the manual setup form copy without the upload workflow choices", async () => {
    await act(async () => {
      root.render(<NewProjectForm />);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Set up review manually");
    expect(container.textContent).toContain(
      "Create a project review without uploading a source document first. You can attach documents and evidence later.",
    );
    expect(container.textContent).toContain("Create Project Review");
    expect(container.textContent).not.toContain("Review Type");
    expect(container.textContent).not.toContain("Methodology-linked review");
  });
});
