import type { Metadata } from "next";
import MethodsFinder from "@/app/m/_components/MethodsFinder";

type PageProps = {
  params: Promise<{ code: string; ver: string }>;
};

export const metadata: Metadata = {
  title: "Evidence Map | app.article6",
  description: "Trace-driven evidence map for a method version.",
};

export default async function EvidencePage({ params }: PageProps) {
  const { code, ver } = await params;
  return <MethodsFinder selectedCode={code} selectedVersion={ver} />;
}
