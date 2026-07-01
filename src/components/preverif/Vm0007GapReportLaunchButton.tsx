"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  buildVm0007GapReportHref,
  hasVm0007GapReportAudit,
} from "@/lib/preverif/vm0007GapReportStore";

type Vm0007GapReportLaunchButtonProps = {
  auditId?: string | null;
};

export default function Vm0007GapReportLaunchButton({ auditId }: Vm0007GapReportLaunchButtonProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(hasVm0007GapReportAudit(auditId));
  }, [auditId]);

  if (!auditId?.trim() || !visible) return null;

  return (
    <Link
      href={buildVm0007GapReportHref(auditId)}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
    >
      <ArrowUpRight className="h-4 w-4" />
      View Gap Report
    </Link>
  );
}
