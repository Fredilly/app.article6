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

  it("renders the starter affordance and keeps quick check collapsed by default", async () => {
    await act(async () => {
      root.render(<ChatApp />);
    });

    expect(container.textContent).toContain("Check one requirement");
    expect(container.textContent).not.toContain("Quick check");
    expect(container.textContent).toContain("Send");
  });

  it("opens the lightweight quick check block from the landing action", async () => {
    await act(async () => {
      root.render(<ChatApp />);
    });

    const button = Array.from(container.querySelectorAll("button")).find((node) =>
      node.textContent?.includes("Check one requirement"),
    );
    expect(button).toBeTruthy();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Quick check");
    expect(container.textContent).toContain("Methodology");
    expect(container.textContent).toContain("Requirement");
    expect(container.textContent).toContain("Check requirement");
  });
});
