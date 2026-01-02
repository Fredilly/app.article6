import AuditApp from "@/components/audit/AuditApp";
import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AUDIT_FEATURE_ENABLED } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Audit | app.article6",
  description: "Upload a methodology PDF to inspect anchors, hashes, and QA checkpoints.",
};

export default function AuditPage() {
  if (!AUDIT_FEATURE_ENABLED) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <Suspense
        fallback={
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-12">
            <div className="h-6 w-56 animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-200" />
          </div>
        }
      >
        <AuditApp />
      </Suspense>
    </main>
  );
}
