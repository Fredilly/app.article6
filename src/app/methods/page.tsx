import type { Metadata } from "next";
import MethodsFinder from "@/app/m/_components/MethodsFinder";

export const metadata: Metadata = {
  title: "Methods | app.article6",
  description: "Methods-first inventory finder.",
};

export default function MethodsPage() {
  return <MethodsFinder />;
}
