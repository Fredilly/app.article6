import type { Metadata } from "next";
import { Suspense } from "react";
import MethodsInventoryApp from "@/components/manifest/MethodsInventoryApp";
import { getMethodInventory } from "@/app/m/_lib/methodInventory";

export const metadata: Metadata = {
  title: "Manifest | app.article6",
  description: "Load covered methodologies and reconcile each requirement against evidence with explicit provenance.",
};

export default async function ManifestPage() {
  const { methods, generatedAt, datasetHash } = await getMethodInventory();
  return (
    <main className="min-h-screen bg-slate-50">
      <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">Loading…</div>}>
        <MethodsInventoryApp methods={methods} generatedAt={generatedAt} datasetHash={datasetHash} />
      </Suspense>
    </main>
  );
}
