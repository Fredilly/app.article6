"use client";

import clsx from "clsx";

type TagChipProps = {
  tag: string;
  active?: boolean;
  onToggle?: (tag: string) => void;
};

export function TagChip({ tag, active = false, onToggle }: TagChipProps) {
  const handleClick = () => {
    onToggle?.(tag);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={clsx(
        "inline-flex h-11 min-w-11 items-center justify-center rounded-full border px-4 text-sm font-medium capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
        active
          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:text-slate-900",
      )}
      aria-pressed={active}
      aria-label={active ? `Remove tag ${tag}` : `Filter by tag ${tag}`}
    >
      {tag}
    </button>
  );
}

export default TagChip;
