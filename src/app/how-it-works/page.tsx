import type { Metadata } from "next";
import PublicReadinessPage from "@/components/PublicReadinessPage";

export const metadata: Metadata = {
  title: "How it works | Article6",
  description: "How Article6 reviews project documentation for pre-validation evidence readiness.",
};

export default function HowItWorksPage() {
  return <PublicReadinessPage page="how-it-works" />;
}
