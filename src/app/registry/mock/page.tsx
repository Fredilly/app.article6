import type { Metadata } from "next";
import MockIssuance from "@/components/registry/MockIssuance";

export const metadata: Metadata = {
  title: "Mock registry issuance | app.article6",
  description: "Preview dummy tCO₂e issuance totals before the live registry launches.",
};

export default function MockRegistryPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <MockIssuance />
    </main>
  );
}
