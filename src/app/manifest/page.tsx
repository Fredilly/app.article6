import type { Metadata } from "next";
import MethodsInventoryApp from "@/components/manifest/MethodsInventoryApp";
import { getMethodInventory } from "@/app/m/_lib/methodInventory";

export const metadata: Metadata = {
  title: "Manifest | app.article6",
  description: "Browse methods first, then drill into rules and anchored evidence.",
};

export default async function ManifestPage() {
  const { methods, generatedAt, datasetHash } = await getMethodInventory();
  return (
    <main className="min-h-screen bg-slate-50">
      <MethodsInventoryApp methods={methods} generatedAt={generatedAt} datasetHash={datasetHash} />
    </main>
  );
}
