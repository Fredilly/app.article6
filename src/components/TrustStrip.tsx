type TrustStripProps = {
  methodCode: string;
  version: string;
  lastUpdatedLabel: string;
};

export default function TrustStrip({ methodCode, version, lastUpdatedLabel }: TrustStripProps) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-slate-900">Method</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
          {methodCode}
        </span>
        <span className="text-slate-400">/</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
          v{version}
        </span>
      </div>
      <div className="text-xs text-slate-500">Last updated: {lastUpdatedLabel}</div>
    </div>
  );
}
