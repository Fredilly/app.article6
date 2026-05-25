/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { act } from "react";
import { createRoot } from "react-dom/client";
import HomePage from "@/app/page";

describe("HomePage", () => {
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
  });

  it("renders the product copy and CTA targets", async () => {
    await act(async () => {
      root.render(<HomePage />);
    });

    expect(container.textContent).toContain("Review carbon project documents faster.");
    const links = Array.from(container.querySelectorAll("a"));
    expect(links.find((link) => link.textContent === "Quick Check")?.getAttribute("href")).toBe("/quick-check");
    expect(links.find((link) => link.textContent === "Open Projects")?.getAttribute("href")).toBe("/projects");
    expect(links.find((link) => link.textContent === "Browse Methods")?.getAttribute("href")).toBe("/methods");
  });
});
