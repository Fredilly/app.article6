/**
 * @jest-environment jsdom
 */

import { useEffect } from "react";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import useManifestFilters, { type ManifestFilters } from "@/app/manifest/_state/useManifestFilters";

const replaceMock = jest.fn();

jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => "/manifest",
  useSearchParams: () => new URLSearchParams("q=baseline&tags=calc"),
}));

function Harness({ onReady }: { onReady: (filters: ManifestFilters) => void }) {
  const filters = useManifestFilters();
  useEffect(() => {
    onReady(filters);
  }, [filters, onReady]);
  return null;
}

async function renderHook(): Promise<{ filters: ManifestFilters; root: Root; container: HTMLDivElement }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  let resolved = false;
  let captured: ManifestFilters | null = null;

  await act(async () => {
    root.render(
      <Harness
        onReady={filters => {
          if (!resolved) {
            resolved = true;
            captured = filters;
          }
        }}
      />,
    );
  });

  if (!captured) {
    throw new Error("Failed to capture manifest filters");
  }

  return { filters: captured, root, container };
}

describe("useManifestFilters", () => {
  beforeEach(() => {
    replaceMock.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("removes a tag from the URL when toggled off", async () => {
    const { filters, root, container } = await renderHook();

    await act(async () => {
      filters.toggleTag("calc");
    });

    const lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1];
    expect(lastCall).toEqual(["/manifest?q=baseline", { scroll: false }]);

    root.unmount();
    container.remove();
  });

  it("applies methodology updates to the URL", async () => {
    const { filters, root, container } = await renderHook();

    await act(async () => {
      filters.setMethodology("AR-AMS0003");
    });

    const lastCall = replaceMock.mock.calls[replaceMock.mock.calls.length - 1];
    expect(lastCall).toEqual([
      "/manifest?q=baseline&methodology=AR-AMS0003&tags=calc",
      { scroll: false },
    ]);

    root.unmount();
    container.remove();
  });
});
