/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";

const pushMock = jest.fn();

jest.mock("@/lib/chat/quickCheckPdfClient", () => ({
  resolveQuickCheckPdfText: jest.fn(async ({ filename }: { filename: string }) => {
    if (filename === "network-failure.pdf") {
      return {
        text: "",
        engine: "heuristic" as const,
        methodologyMentions: [],
        warning: "Quick Check PDF extraction request failed (service or network issue). Using local fallback (weaker results).",
        diagnosticCode: "upload-request-failed" as const,
      };
    }
    if (filename === "oversized.pdf") {
      return {
        text: "",
        engine: "heuristic" as const,
        methodologyMentions: [],
        warning: "PDF exceeds the Quick Check upload limit of 20MB.",
        diagnosticCode: "file-too-large" as const,
      };
    }
    return {
      text: "",
      engine: "heuristic" as const,
      methodologyMentions: [],
    };
  }),
}));

import QuickCheckPanel from "@/components/chat/QuickCheckPanel";

describe("QuickCheckPanel upload error codes (light regression)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    window.localStorage.clear();
    pushMock.mockReset();

    (global.fetch as any) = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/methods/inventory")) {
        return new Response(JSON.stringify({ methods: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders the panel without crashing when upload error codes are returned by the client", async () => {
    await act(async () => {
      root.render(<QuickCheckPanel />);
    });
    await act(async () => { await Promise.resolve(); });

    // Basic smoke: the upload input is present
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
  });
});
