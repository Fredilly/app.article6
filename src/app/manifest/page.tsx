import type { Metadata } from "next";
import { Suspense } from "react";
import ManifestApp from "@/components/manifest/ManifestApp";

export const metadata: Metadata = {
  title: "Manifest | app.article6",
  description: "Search methodology rules and jump straight to anchored provenance.",
};

export default function ManifestPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Suspense
        fallback={
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-12">
            <div className="h-6 w-48 animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-200" />
          </div>
        }
      >
        <ManifestApp />
      </Suspense>
    </main>
  );
}
