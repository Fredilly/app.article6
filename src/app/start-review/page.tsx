import type { Metadata } from "next";
import ChatApp from "@/components/chat/ChatApp";
import NewProjectForm from "@/components/projects/NewProjectForm";

export const metadata: Metadata = {
  title: "Start Review | app.article6",
  description: "Upload a PDD, monitoring report, or evidence file to start a review.",
};

type StartReviewPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pickFirst(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function StartReviewPage({ searchParams }: StartReviewPageProps) {
  const params = await searchParams;
  const mode = pickFirst(params.mode);

  return (
    <main className="min-h-screen bg-slate-50">
      {mode === "quick-check" ? <ChatApp /> : <NewProjectForm />}
    </main>
  );
}
