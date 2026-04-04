/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/",
}));

jest.mock("@/lib/chat/client", () => ({
  sendChat: jest.fn(),
  retrieveQuery: jest.fn(),
}));

import ChatApp from "@/components/chat/ChatApp";

describe("ChatApp quick check entry", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (global.fetch as typeof fetch | undefined) = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/methods/inventory")) {
        return new Response(
          JSON.stringify({
            methods: [{ code: "AR-ACM0003", latestVersion: "v02-0", versions: ["v02-0"] }],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/methods/AR-ACM0003/v/v02-0/rules")) {
        return new Response(
          JSON.stringify({
            rules: [
              {
                id: "R-1-0001",
                title: "Monitoring frequency",
                snippet: "Maintain a monitoring report.",
                tags: [],
                expectedEvidence: ["monitoring-report"],
              },
            ],
          }),
          { status: 200 },
        );
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
    jest.clearAllMocks();
  });

  it("renders the command card above chat by default", async () => {
    await act(async () => {
      root.render(<ChatApp />);
    });

    expect(container.textContent).toContain("Verify one requirement");
    expect(container.textContent).toContain("Ask in chat instead");
    expect(container.textContent).toContain("Check requirement");
    expect(container.textContent).toContain("Send");
  });

  it("keeps chat visible below the command card", async () => {
    await act(async () => {
      root.render(<ChatApp />);
    });

    const pageText = container.textContent ?? "";
    expect(pageText).toContain("Verify one requirement");
    expect(container.textContent).toContain("Methodology");
    expect(container.textContent).toContain("Requirement");
    expect(container.textContent).toContain("Check requirement");
    expect(pageText.indexOf("Verify one requirement")).toBeLessThan(pageText.indexOf("Welcome to Article6"));
  });
});
