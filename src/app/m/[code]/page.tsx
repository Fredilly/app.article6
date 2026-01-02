import type { Metadata } from "next";
import MethodsFinder from "@/app/m/_components/MethodsFinder";

type PageProps = {
  params: Promise<{ code: string }>;
};

export const metadata: Metadata = {
  title: "Method | app.article6",
  description: "Method inventory selection route.",
};

export default async function MethodPage({ params }: PageProps) {
  const { code } = await params;
  return <MethodsFinder selectedCode={code} />;
}
