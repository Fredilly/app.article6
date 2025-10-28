/**
 * @jest-environment jsdom
 */

import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import HashCopyButton from "@/components/manifest/HashCopyButton";

describe("HashCopyButton", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
      writable: true,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    (navigator.clipboard.writeText as jest.Mock).mockReset();
  });

  it("copies the provided hash when clicked", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<HashCopyButton hash="abc123" />);
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("abc123");

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    root.unmount();
    container.remove();
  });

  it("stays disabled when hash is missing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<HashCopyButton />);
    });

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();

    root.unmount();
    container.remove();
  });
});
