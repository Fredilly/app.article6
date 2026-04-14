import type { Metadata } from 'next';
import ProjectsList from '@/components/projects/ProjectsList';

export const metadata: Metadata = {
  title: 'Projects | app.article6',
  description: 'Project verification workbench — track methodology verifications.',
};

export default function ProjectsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <ProjectsList />
    </main>
  );
}
