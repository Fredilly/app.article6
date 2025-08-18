"use client";
import * as React from "react";

const DialogContext = React.createContext<{
  open: boolean;
  setOpen: (o: boolean) => void;
} | null>(null);

export function Dialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({ children }: { children: React.ReactNode }) {
  const ctx = React.useContext(DialogContext);
  if (!ctx) return null;
  return (
    <span onClick={() => ctx.setOpen(true)} className="inline-block">
      {children}
    </span>
  );
}

export function DialogContent({ children }: { children: React.ReactNode }) {
  const ctx = React.useContext(DialogContext);
  if (!ctx || !ctx.open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card p-6 max-w-md w-full">
        {children}
        <button onClick={() => ctx.setOpen(false)} className="btn mt-4 w-full">
          Close
        </button>
      </div>
    </div>
  );
}
