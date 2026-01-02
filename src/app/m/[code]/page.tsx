import type { Metadata } from "next";
import MethodsFinder from "@/app/m/_components/MethodsFinder";

type PageProps = {
  params: Promise<{ code: string }>;
  searchParams?: Promise<{ rule?: string; section?: string }>;
};

export const metadata: Metadata = {
  title: "Method | app.article6",
  description: "Method inventory selection route.",
};

export default async function MethodPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const resolvedSearch = await Promise.resolve(searchParams);
  const rule = typeof resolvedSearch?.rule === "string" ? resolvedSearch.rule : undefined;
  const section = typeof resolvedSearch?.section === "string" ? resolvedSearch.section : undefined;
  return <MethodsFinder selectedCode={code} selectedRuleId={rule} selectedSectionId={section} />;
}
