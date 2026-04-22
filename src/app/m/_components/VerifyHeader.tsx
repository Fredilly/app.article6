"use client";

type VerifyMode = "list" | "map";

type VerifyHeaderProps = {
  mode: VerifyMode;
  verifierMode: boolean;
  onChangeMode: (mode: VerifyMode) => void;
  onToggleVerifierMode: () => void;
};

export default function VerifyHeader({
  mode,
  verifierMode,
  onChangeMode,
  onToggleVerifierMode,
}: VerifyHeaderProps) {

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Requirement coverage</h1>
        <p className="text-sm text-slate-600">
          Reconcile methodology requirements against linked evidence before validation, verification, or diligence.
        </p>
        <span className="sr-only">List Map Upload AOI Search STAC evidence Requirement coverage</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm transition ${
            verifierMode
              ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          onClick={onToggleVerifierMode}
          aria-pressed={verifierMode}
        >
          Verifier mode
        </button>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1">
        {(["list", "map"] as VerifyMode[]).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              mode === nextMode ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => onChangeMode(nextMode)}
            aria-pressed={mode === nextMode}
          >
            {nextMode === "list" ? "List" : "Map"}
          </button>
        ))}
        </div>
      </div>
    </header>
  );
}
