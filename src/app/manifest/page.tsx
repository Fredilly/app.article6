import type { Metadata } from "next";
import HealthBadge from "@/components/HealthBadge";
import ManifestApp from "@/components/manifest/ManifestApp";

export const metadata: Metadata = {
  title: "Manifest | app.article6",
  description: "Search methodology rules and jump straight to anchored provenance.",
};

export default function ManifestPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white/80">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Verification surfaces
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              Manifest health signal
            </h2>
          </div>
          <HealthBadge />
        </div>
      </section>
      <ManifestApp />
    </main>
  );
}
