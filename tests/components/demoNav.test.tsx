/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";

const pathnameState = { value: "/" };

jest.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

import DemoNav from "@/components/DemoNav";

describe("DemoNav", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  it("shows Quick Check, Methods, and Projects destinations", async () => {
    pathnameState.value = "/";
    await act(async () => {
      root.render(<DemoNav />);
    });

    const links = Array.from(container.querySelectorAll("a"));
    expect(links.map((link) => link.textContent)).toEqual(
      expect.arrayContaining(["Quick Check", "Methods", "Projects"]),
    );
    expect(links.find((link) => link.textContent?.includes("Quick Check"))?.getAttribute("href")).toBe("/start-review");
    expect(links.find((link) => link.textContent?.includes("Methods"))?.getAttribute("href")).toBe("/m");
    expect(links.find((link) => link.textContent?.includes("Projects"))?.getAttribute("href")).toBe("/projects");
  });

  it("lets the user return to Quick Check from Methods in one click", async () => {
    pathnameState.value = "/m";
    await act(async () => {
      root.render(<DemoNav />);
    });

    const quickCheckLink = Array.from(container.querySelectorAll("a")).find((link) =>
      link.textContent?.includes("Quick Check"),
    );
    expect(quickCheckLink?.getAttribute("href")).toBe("/start-review");
  });
});
