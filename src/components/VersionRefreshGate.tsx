"use client";

import { useEffect } from "react";
import { detectAppVersionChange } from "@/lib/appVersion";

export default function VersionRefreshGate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    detectAppVersionChange();
  }, []);

  return <>{children}</>;
}
