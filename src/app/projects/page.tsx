import type { Metadata } from 'next';
import ProjectsList from '@/components/projects/ProjectsList';

export const metadata: Metadata = {
  title: 'Projects | app.article6',
  description: 'Project readiness workspace for methodology-linked and evidence-led follow-up.',
};

export default function ProjectsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <ProjectsList />
    </main>
  );
}
