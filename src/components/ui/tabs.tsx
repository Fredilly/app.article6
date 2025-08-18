"use client";
import * as React from "react";

const TabsContext = React.createContext<{
  value: string;
  setValue: (v: string) => void;
} | null>(null);

export function Tabs({ defaultValue, children }: { defaultValue: string; children: React.ReactNode }) {
  const [value, setValue] = React.useState(defaultValue);
  return <TabsContext.Provider value={{ value, setValue }}>{children}</TabsContext.Provider>;
}

export function TabsList({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`flex gap-2 ${className}`}>{children}</div>;
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) return null;
  const active = ctx.value === value;
  return (
    <button
      className={`px-3 py-1 rounded-2xl border ${active ? "bg-foreground text-background" : ""}`}
      onClick={() => ctx.setValue(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(TabsContext);
  if (!ctx || ctx.value !== value) return null;
  return <div className="pt-4">{children}</div>;
}
