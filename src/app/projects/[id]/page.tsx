import type { Metadata } from 'next';
import ProjectDetail from '@/components/projects/ProjectDetail';

type PageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: 'Project | app.article6',
};

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <main className="min-h-screen bg-slate-50">
      <ProjectDetail projectId={id} />
    </main>
  );
}
