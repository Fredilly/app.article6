"use client";

import { useMemo, useState } from "react";
import { MOCK_ISSUANCES, calculateTotals } from "@/lib/registry/mock";

export default function MockIssuance() {
  const [showRetired, setShowRetired] = useState(true);
  const totals = useMemo(() => calculateTotals(MOCK_ISSUANCES), []);

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold text-slate-900">Mock registry issuance</h1>
          <p className="text-sm text-slate-600">
            This sandbox aggregates dummy tCO₂e issuance records so investors can preview balances before the live registry goes online.
          </p>
        </header>

        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3">
          <MetricCard label="Total issued" value={formatTonnes(totals.issued)} accent="bg-emerald-100 text-emerald-700" />
          <MetricCard label="Total retired" value={formatTonnes(totals.retired)} accent="bg-amber-100 text-amber-700" />
          <MetricCard label="Current balance" value={formatTonnes(totals.balance)} accent="bg-slate-100 text-slate-700" />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Issuance ledger</h2>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-slate-800 focus:ring-slate-600"
                checked={showRetired}
                onChange={() => setShowRetired(prev => !prev)}
              />
              Show retired amounts
            </label>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Methodology</th>
                  <th className="px-3 py-2">Vintage</th>
                  <th className="px-3 py-2 text-right">Issued (tCO₂e)</th>
                  {showRetired ? <th className="px-3 py-2 text-right">Retired (tCO₂e)</th> : null}
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {MOCK_ISSUANCES.map(record => {
                  const balance = record.issued - record.retired;
                  return (
                    <tr key={record.id} className="text-slate-700">
                      <td className="px-3 py-2 font-medium">{record.project}</td>
                      <td className="px-3 py-2">{record.methodology}</td>
                      <td className="px-3 py-2">{record.vintage}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatTonnes(record.issued)}</td>
                      {showRetired ? (
                        <td className="px-3 py-2 text-right font-mono text-slate-500">{formatTonnes(record.retired)}</td>
                      ) : null}
                      <td className="px-3 py-2 text-right font-mono">{formatTonnes(balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  accent: string;
};

function MetricCard({ label, value, accent }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <span className={`mt-2 inline-flex items-center rounded-md px-2 py-1 text-xl font-semibold ${accent}`}>
        {value}
      </span>
    </div>
  );
}

function formatTonnes(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
