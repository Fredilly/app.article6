"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { canonicalEvidencePath } from "@/lib/nav/canonicalEvidence";

type EvidenceCanonicalizerProps = {
  children: ReactNode;
};

export default function EvidenceCanonicalizer({ children }: EvidenceCanonicalizerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) return;
    const nextPath = canonicalEvidencePath(pathname, searchParams);
    if (!nextPath) return;
    router.replace(nextPath, { scroll: false });
  }, [pathname, router, searchParams]);

  return <>{children}</>;
}
