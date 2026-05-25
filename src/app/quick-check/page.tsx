import { Suspense } from "react";
import type { Metadata } from "next";
import ChatApp from "@/components/chat/ChatApp";

export const metadata: Metadata = {
  title: "Quick Check | app.article6",
  description: "Upload a carbon project document and check what it can support.",
};

export default function QuickCheckPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Suspense
        fallback={
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-12 md:px-8">
            <div className="h-6 w-56 animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-200" />
          </div>
        }
      >
        <ChatApp />
      </Suspense>
    </main>
  );
}
