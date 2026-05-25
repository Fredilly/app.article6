import type { Metadata } from "next";
import MethodsFinder from "@/app/m/_components/MethodsFinder";

export const metadata: Metadata = {
  title: "Methods | app.article6",
  description: "Browse carbon project methodologies and open a method review.",
};

export default function MethodsPage() {
  return <MethodsFinder />;
}
