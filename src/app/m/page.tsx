import type { Metadata } from "next";
import FinderShell from "@/components/FinderShell";
import TrustStrip from "@/components/TrustStrip";

export const metadata: Metadata = {
  title: "Methods | app.article6",
  description: "Methods-first inventory and finder scaffold.",
};

const MOCK_METHODS = [
  { code: "AR-AM0014", program: "ART", sector: "Forestry" },
  { code: "VM0047", program: "VCS", sector: "Waste" },
  { code: "GS-VER-001", program: "Gold", sector: "Energy" },
];

export default function MethodsInventoryPage() {
  const selected = MOCK_METHODS[0];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 md:px-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Method Inventory
          </h1>
          <p className="text-sm text-slate-600">
            Scaffold: methods-first finder shell with placeholders only.
          </p>
        </header>

        <TrustStrip methodCode={selected.code} version="latest" lastUpdatedLabel="—" />

        <FinderShell
          left={
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">Methods</h2>
                <span className="text-xs text-slate-500">{MOCK_METHODS.length} items</span>
              </div>
              <ul className="flex flex-col gap-2">
                {MOCK_METHODS.map(method => (
                  <li key={method.code}>
                    <div
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left ${
                        method.code === selected.code
                          ? "border-slate-300 bg-slate-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-mono text-sm text-slate-900">{method.code}</span>
                        <span className="text-xs text-slate-500">
                          {method.program} • {method.sector}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">Select</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          }
          right={
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Detail</h2>
              <p className="mt-1 text-sm text-slate-600">
                Placeholder for method overview, versions, rules, and evidence panels.
              </p>
              <div className="mt-4 grid gap-3">
                <div className="h-16 rounded-lg border border-dashed border-slate-200 bg-slate-50" />
                <div className="h-16 rounded-lg border border-dashed border-slate-200 bg-slate-50" />
                <div className="h-16 rounded-lg border border-dashed border-slate-200 bg-slate-50" />
              </div>
            </div>
          }
        />
      </div>
    </main>
  );
}
