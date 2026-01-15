import type { Metadata } from "next";
import EvidenceView from "@/app/m/_components/EvidenceView";
import EvidenceCanonicalizer from "@/app/m/[code]/v/[ver]/evidence/EvidenceCanonicalizer";

type PageProps = {
  params: Promise<{ code: string; ver: string }>;
};

export const metadata: Metadata = {
  title: "Evidence Map | app.article6",
  description: "Trace-driven evidence map for a method version.",
};

export default async function EvidencePage({ params }: PageProps) {
  const { code, ver } = await params;
  return (
    <EvidenceCanonicalizer>
      <EvidenceView selectedCode={code} selectedVersion={ver} />
    </EvidenceCanonicalizer>
  );
}
