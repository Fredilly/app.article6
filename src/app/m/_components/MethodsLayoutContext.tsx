"use client";

import { createContext, useContext, type ReactNode } from "react";

type MethodsLayoutContextValue = {
  isVerifyTab: boolean;
  methodsCollapsed: boolean;
  setMethodsCollapsed: (value: boolean) => void;
};

const MethodsLayoutContext = createContext<MethodsLayoutContextValue | null>(null);

export function MethodsLayoutProvider({
  value,
  children,
}: {
  value: MethodsLayoutContextValue;
  children: ReactNode;
}) {
  return <MethodsLayoutContext.Provider value={value}>{children}</MethodsLayoutContext.Provider>;
}

export function useMethodsLayout() {
  return useContext(MethodsLayoutContext);
}
