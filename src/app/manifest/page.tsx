import type { Metadata } from "next";
import ManifestApp from "@/components/manifest/ManifestApp";

export const metadata: Metadata = {
  title: "Manifest | app.article6",
  description: "Search methodology rules and jump straight to anchored provenance.",
};

export default function ManifestPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <ManifestApp />
    </main>
  );
}
