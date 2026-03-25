/** @jest-environment jsdom */

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createRoot, type Root } from "react-dom/client";

let mockPathname = "/m/AR-TEST0001/v/v1-0";
let mockSearch = "tab=rules";

const routerPush = jest.fn<(href: string, options?: { scroll?: boolean }) => void>();
const routerReplace = jest.fn<(href: string, options?: { scroll?: boolean }) => void>();

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

jest.mock("@/app/m/_components/VersionSelector", () => ({
  __esModule: true,
  default: () => <div data-testid="version-selector" />,
}));

jest.mock("@/app/m/_components/IntegrityDiffPanel", () => ({
  __esModule: true,
  IntegrityDiffPanel: () => <div>Integrity diff</div>,
}));

jest.mock("@/components/TrustStrip", () => ({
  __esModule: true,
  default: () => <div data-testid="trust-strip" />,
}));

jest.mock("@/components/map/ProofMapTab", () => ({
  __esModule: true,
  default: ({ onViewRule }: { onViewRule?: (ruleId: string) => void }) => (
    <button type="button" onClick={() => onViewRule?.("R-1")}>
      View selected rule
    </button>
  ),
}));

jest.mock("@/app/m/_components/VerifyHeader", () => ({
  __esModule: true,
  default: () => <div data-testid="verify-header" />,
}));

jest.mock("@/app/m/_components/MethodsLayoutContext", () => ({
  useMethodsLayout: () => null,
}));

jest.mock("@/components/actions/ShareLinkButton", () => ({
  __esModule: true,
  default: () => <div data-testid="share-link-button" />,
}));

jest.mock("@/components/coverage/CoveragePanel", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/coverage/CoverageDrawer", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/lib/auditTrail/store", () => ({
  useAuditTrail: () => ({
    events: [],
    appendEvent: () => {},
    clearTrail: () => {},
    exportJson: null,
    exportSha256: null,
  }),
}));

jest.mock("@/lib/proofMap/storage", () => ({
  clearProofMapStorage: () => {},
  clearStoredMapView: () => {},
  loadAoi: () => null,
  loadDraftAoi: () => null,
  loadEvidenceSnapshots: () => [],
  loadPins: () => [],
  loadVerificationRuns: () => [],
  saveAoi: () => {},
  saveDraftAoi: () => {},
  saveEvidenceSnapshots: () => {},
  savePins: () => {},
  saveVerificationRuns: () => {},
}));

jest.mock("@/lib/proof/import", () => ({
  importProofBundleText: async () => ({ ok: false }),
}));

const MethodDetailPane = require("@/app/m/_components/MethodDetailPane").default as typeof import("@/app/m/_components/MethodDetailPane").default;

const method = {
  code: "AR-TEST0001",
  program: "AFOLU",
  sector: "ARR",
  versions: ["v1-0"],
  latestVersion: "v1-0",
  versionCount: 1,
  hasRich: false,
  hasPrevious: false,
  ruleCountByVersion: { "v1-0": 1 },
};

function setUrl(search: string) {
  mockSearch = search;
  const href = search ? `${mockPathname}?${search}` : mockPathname;
  window.history.replaceState({}, "", href);
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("MethodDetailPane rule modal", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = jest.fn<typeof fetch>();

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    routerPush.mockClear();
    routerReplace.mockClear();
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
  });

  it("opens a readable modal from the rules list and closes on escape", async () => {
    setUrl("tab=rules");
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/rules?id=R-1")) {
        return new Response(
          JSON.stringify({
            rule: {
              id: "R-1",
              title: "Readable rule title",
              text: "Rule text body",
              tags: ["eligibility"],
              type: "eligibility",
              sectionId: "S-1",
              anchor: "#S-1",
              sha256: "abc123",
              sourcePath: "rules.json",
            },
          }),
        );
      }
      if (url.endsWith("/rules")) {
        return new Response(
          JSON.stringify({
            rules: [{ id: "R-1", title: "Readable rule title", snippet: "Rule snippet", tags: ["eligibility"] }],
          }),
        );
      }
      if (url.endsWith("/trace")) {
        return new Response(
          JSON.stringify({
            trace: { version: 1, rule_to_sections: { "R-1": [{ section_id: "S-1", title: "Section One", match: "explicit" }] } },
          }),
        );
      }
      if (url.endsWith("/sections")) {
        return new Response(
          JSON.stringify({
            sections: [{ id: "S-1", title: "Section One", level: 1, textSnippet: "Grounded passage" }],
          }),
        );
      }
      throw new Error(`Unhandled fetch ${url}`);
    });

    await act(async () => {
      root.render(<MethodDetailPane method={method} activeVersion="v1-0" />);
    });
    await flush();

    const ruleButton = Array.from(container.querySelectorAll("button")).find(
      (node) => node.textContent?.includes("Readable rule title"),
    );
    expect(ruleButton).toBeTruthy();

    await act(async () => {
      ruleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const dialog = document.querySelector('[aria-label="Rule detail"]');
    expect(dialog).toBeTruthy();
    const text = dialog?.textContent ?? "";
    expect(text.indexOf("Rule text")).toBeLessThan(text.indexOf("Grounded method passage"));
    expect(text.indexOf("Grounded method passage")).toBeLessThan(text.indexOf("Project evidence"));
    expect(text.indexOf("Project evidence")).toBeLessThan(text.indexOf("Reasoning and assessment"));
    expect(text.indexOf("Reasoning and assessment")).toBeLessThan(text.indexOf("Provenance"));
    expect(routerPush).toHaveBeenCalledWith(expect.stringContaining("rule=R-1"), { scroll: false });
    expect(routerPush).toHaveBeenCalledWith(expect.stringContaining("focus=rule-detail"), { scroll: false });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(document.querySelector('[aria-label="Rule detail"]')).toBeNull();
    expect(routerReplace).toHaveBeenCalledWith(expect.stringContaining("rule=R-1"), { scroll: false });
    expect(routerReplace).not.toHaveBeenCalledWith(expect.stringContaining("focus=rule-detail"), { scroll: false });
  });

  it("opens from verify without leaving the current screen and preserves the selected rule in the URL", async () => {
    setUrl("tab=verify&rule=R-1");
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/rules?id=R-1")) {
        return new Response(
          JSON.stringify({
            rule: {
              id: "R-1",
              title: "Readable rule title",
              text: "Rule text body",
              tags: ["eligibility"],
              type: "eligibility",
              sectionId: "S-1",
              anchor: "#S-1",
              sha256: "abc123",
              sourcePath: "rules.json",
            },
          }),
        );
      }
      if (url.endsWith("/rules")) {
        return new Response(
          JSON.stringify({
            rules: [{ id: "R-1", title: "Readable rule title", snippet: "Rule snippet", tags: ["eligibility"] }],
          }),
        );
      }
      if (url.endsWith("/trace")) {
        return new Response(JSON.stringify({ trace: { version: 1, rule_to_sections: {} } }));
      }
      if (url.endsWith("/sections")) {
        return new Response(JSON.stringify({ sections: [] }));
      }
      throw new Error(`Unhandled fetch ${url}`);
    });

    await act(async () => {
      root.render(<MethodDetailPane method={method} activeVersion="v1-0" />);
    });
    await flush();

    const verifyButton = Array.from(container.querySelectorAll("button")).find(
      (node) => node.textContent?.includes("View selected rule"),
    );
    expect(verifyButton).toBeTruthy();

    await act(async () => {
      verifyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(document.querySelector('[aria-label="Rule detail"]')).toBeTruthy();
    expect(routerPush).toHaveBeenCalledWith(expect.stringContaining("tab=verify"), { scroll: false });
    expect(routerPush).toHaveBeenCalledWith(expect.stringContaining("rule=R-1"), { scroll: false });
    expect(routerPush).toHaveBeenCalledWith(expect.stringContaining("focus=rule-detail"), { scroll: false });

    const closeButton = Array.from(document.querySelectorAll("button")).find(
      (node) => node.textContent?.trim() === "Close",
    );
    expect(closeButton).toBeTruthy();

    await act(async () => {
      closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.querySelector('[aria-label="Rule detail"]')).toBeNull();
    expect(routerReplace).toHaveBeenCalledWith(expect.stringContaining("tab=verify"), { scroll: false });
    expect(routerReplace).toHaveBeenCalledWith(expect.stringContaining("rule=R-1"), { scroll: false });
  });
});
