import type { Metadata } from 'next';
import ChatApp from '@/components/chat/ChatApp';
import NewProjectForm from '@/components/projects/NewProjectForm';

export const metadata: Metadata = {
  title: 'Quick Check | app.article6',
  description: 'Upload a project document. Article6 will detect the project details, identify the likely methodology, and prepare the next readiness step.',
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
  const showProjectSetup =
    handoff === 'document-metadata' || handoff === 'active-review';

  return (
    <main className="min-h-screen bg-slate-50">
      {showProjectSetup ? (
        <NewProjectForm />
      ) : (
        <div className="pb-12">
          <div className="mx-auto flex w-full max-w-6xl items-start gap-6 px-4 pt-8 md:px-8">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Quick Check</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Upload a project document. Article6 will detect the project details, identify the likely methodology, and prepare the next readiness step.
              </p>
            </div>
          </div>
          <ChatApp surface="start-review" />
        </div>
      )}
    </main>
  );
}
