import type { Metadata } from "next";
import ProjectPreValidationReadinessReport from "@/components/projects/ProjectPreValidationReadinessReport";

export const metadata: Metadata = {
  title: "Project Pre-Validation Readiness Report | app.article6",
  description: "Project-specific Pre-Validation Readiness Report from finalized presentation data.",
};

export default async function ProjectPreValidationReadinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectPreValidationReadinessReport projectId={id} />;
}
