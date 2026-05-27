import type { Metadata } from "next";
import MethodsFinder from "@/app/m/_components/MethodsFinder";

export const metadata: Metadata = {
  title: "Methods | app.article6",
  description: "Methodology and rule source for readiness work.",
};

export default function MethodsPage() {
  return <MethodsFinder />;
}
