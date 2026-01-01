"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

type DrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Drawer({ open, title, description, onClose, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/30"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-start justify-between gap-4 px-6 py-5">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
              {description ? (
                <p className="mt-1 text-sm text-slate-600">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500 focus-visible:outline-offset-2"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </div>
        <div className="px-6 py-6">{children}</div>
      </aside>
    </div>
  );
}

