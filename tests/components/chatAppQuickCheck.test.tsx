/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/",
}));

import ChatApp from "@/components/chat/ChatApp";

describe("ChatApp claim-first landing", () => {
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

  it("renders the claim-first command card and removes chat from the landing page", async () => {
    await act(async () => {
      root.render(<ChatApp />);
    });

    expect(container.textContent).toContain("Verify one claim");
    expect(container.textContent).toContain("Upload evidence. Get a preliminary match in seconds.");
    expect(container.textContent).toContain("Evidence");
    expect(container.textContent).toContain("Try demo check");
    expect(container.textContent).toContain("Run quick check");
    expect(container.textContent).toContain("Upload evidence");
    expect(container.querySelectorAll("textarea").length).toBe(1);
    expect(container.textContent).toContain("Options");
    expect(container.textContent).not.toContain("Select saved evidence");
    expect(container.textContent).not.toContain("MethodologyAny methodology");
    expect(container.textContent).not.toContain("Ask in chat instead");
    expect(container.textContent).not.toContain("Send");
    expect(container.textContent).not.toContain("Welcome to Article6");
    expect(container.textContent).not.toContain("One claim. One file.");
  });
});
