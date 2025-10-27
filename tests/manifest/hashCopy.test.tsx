/** @jest-environment jsdom */

import { beforeEach, describe, expect, it, afterEach, jest } from "@jest/globals";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";

import HashCopyButton from "@/components/manifest/HashCopyButton";

describe("HashCopyButton", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalNavigator = global.navigator;
  let originalClipboard: Clipboard | undefined;
  const writeText = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    jest.useFakeTimers();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    if (!global.navigator) {
      (global as any).navigator = {} as Navigator;
    }
    originalClipboard = (global.navigator as any).clipboard;
    (global.navigator as any).clipboard = { writeText } as Clipboard;
    act(() => {
      root = createRoot(container);
      root.render(<HashCopyButton hash="abc123" />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    writeText.mockClear();
    if (originalClipboard === undefined) {
      delete (global.navigator as any).clipboard;
    } else {
      (global.navigator as any).clipboard = originalClipboard;
    }
    if (!originalNavigator) {
      delete (global as any).navigator;
    } else {
      (global as any).navigator = originalNavigator;
    }
  });

  it("copies the provided hash and resets state", async () => {
    const button = container.querySelector("button")!;

    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(writeText).toHaveBeenCalledWith("abc123");
    expect(button.className).toContain("border-emerald-500");

    act(() => {
      jest.advanceTimersByTime(1600);
    });

    expect(button.className).not.toContain("border-emerald-500");
  });
});
