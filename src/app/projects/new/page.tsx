import { Suspense } from 'react';
import type { Metadata } from 'next';
import NewProjectForm from '@/components/projects/NewProjectForm';

export const metadata: Metadata = {
  title: 'New Project Review | app.article6',
};

export default function NewProjectPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Suspense fallback={null}>
        <NewProjectForm />
      </Suspense>
    </main>
  );
}
