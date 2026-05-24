import type { Metadata } from "next";
import NewProjectForm from "@/components/projects/NewProjectForm";

export const metadata: Metadata = {
  title: "Start Review | app.article6",
};

export default function NewProjectPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <NewProjectForm />
    </main>
  );
}
