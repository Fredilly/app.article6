import type { Metadata } from "next";
import Link from "next/link";
import ChatApp from "@/components/chat/ChatApp";
import NewProjectForm from "@/components/projects/NewProjectForm";

export const metadata: Metadata = {
  title: "Start Review | app.article6",
  description: "Upload project documents, run a quick evidence check, or set up a review workspace.",
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
  const handoff = pickFirst(params.handoff);
  const mode = pickFirst(params.mode);
  const showProjectSetup =
    handoff === "document-metadata" || handoff === "active-review" || mode === "manual";

  return (
    <main className="min-h-screen bg-slate-50">
      {showProjectSetup ? (
        <NewProjectForm />
      ) : (
        <div className="pb-12">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-8 md:px-8">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Start Review</h1>
              <p className="mt-1 text-sm text-slate-600">
                Upload a project document, run a quick evidence check, or switch to manual setup.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/start-review?mode=manual"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400"
              >
                Set up manually
              </Link>
              <Link
                href="/projects"
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400"
              >
                Existing projects
              </Link>
            </div>
          </div>
          <ChatApp />
        </div>
      )}
    </main>
  );
}
