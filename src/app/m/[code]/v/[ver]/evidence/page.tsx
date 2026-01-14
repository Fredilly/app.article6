import type { Metadata } from "next";
import EvidenceMapPage from "@/app/m/_components/EvidenceMapPage";

type PageProps = {
  params: Promise<{ code: string; ver: string }>;
};

export const metadata: Metadata = {
  title: "Evidence Map | app.article6",
  description: "Trace-driven evidence map for a method version.",
};

export default async function EvidencePage({ params }: PageProps) {
  const { code, ver } = await params;
  return <EvidenceMapPage methodCode={code} version={ver} />;
}
