import type { Metadata } from "next";
import MethodsFinder from "@/app/m/_components/MethodsFinder";

type PageProps = {
  params: Promise<{ code: string; ver: string }>;
};

export const metadata: Metadata = {
  title: "Method Version | app.article6",
  description: "Method inventory selection route for a specific version.",
};

export default async function MethodVersionPage({ params }: PageProps) {
  const { code, ver } = await params;
  return <MethodsFinder selectedCode={code} selectedVersion={ver} />;
}
