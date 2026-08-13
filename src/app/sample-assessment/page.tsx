import type { Metadata } from "next";
import PublicReadinessPage from "@/components/PublicReadinessPage";

export const metadata: Metadata = {
  title: "Sample assessment | Article6",
  description: "A sample of the evidence gaps Article6 can surface before validation begins.",
};

export default function SampleAssessmentPage() {
  return <PublicReadinessPage page="sample-assessment" />;
}
