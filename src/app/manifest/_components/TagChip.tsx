"use client";

type TagChipProps = {
  label: string;
  active: boolean;
  onToggle: () => void;
};

export default function TagChip({ label, active, onToggle }: TagChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`inline-flex min-h-[2.75rem] items-center justify-center rounded-full border px-4 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2 ${
        active
          ? "border-slate-800 bg-slate-800 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}
