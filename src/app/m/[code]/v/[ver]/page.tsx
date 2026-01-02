import type { Metadata } from "next";
import MethodsFinder from "@/app/m/_components/MethodsFinder";

type PageProps = {
  params: Promise<{ code: string; ver: string }>;
  searchParams?: Promise<{ rule?: string }>;
};

export const metadata: Metadata = {
  title: "Method Version | app.article6",
  description: "Method inventory selection route for a specific version.",
};

export default async function MethodVersionPage({ params, searchParams }: PageProps) {
  const { code, ver } = await params;
  const resolvedSearch = await Promise.resolve(searchParams);
  const rule = typeof resolvedSearch?.rule === "string" ? resolvedSearch.rule : undefined;
  return <MethodsFinder selectedCode={code} selectedVersion={ver} selectedRuleId={rule} />;
}
