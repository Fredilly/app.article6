import AuditApp from "@/components/audit/AuditApp";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audit | app.article6",
  description: "Upload a methodology PDF to inspect anchors, hashes, and QA checkpoints.",
};

export default function AuditPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <AuditApp />
    </main>
  );
}
