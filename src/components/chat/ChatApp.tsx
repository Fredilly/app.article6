"use client";
import React from "react";
import { useState } from "react";
import { sendChat, retrieveQuery, type QueryResponse } from "@/lib/chat/client";
import type { ChatMessage } from "@/lib/chat/schema";
import { Menu, PanelsTopLeft } from "lucide-react";
import SidePane from "./SidePane";
import MessageList from "./MessageList";
import Composer from "./Composer";
import { cn } from "@/lib/utils";

export default function ChatApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Welcome to Article6 — What would you like to verify? Upload a map later; for now, chat is ready."
    }
  ]);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<QueryResponse["results"]>([]);
  const [metrics, setMetrics] = useState<QueryResponse["metrics"]>([]);
  const [engineTag, setEngineTag] = useState<string>("mvp-baselines-v1");

  async function onSend(text: string) {
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const out = await retrieveQuery(text);
      setResults(out.results ?? []);
      setMetrics(out.metrics ?? []);
      setEngineTag(out.engineTag ?? "mvp-baselines-v1");
      setMessages([
        ...next,
        { role: "assistant", content: `Found ${out.results?.length ?? 0} rule cards.` }
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages([...next, { role: "assistant", content: `Error: ${message}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function onUploadImage(dataUrl: string) {
    const next: ChatMessage[] = [...messages, { role: "user", content: "", image: dataUrl }];
    setMessages(next);
    setBusy(true);
    try {
      const out = await sendChat(next);
      setMessages(out);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages([...next, { role: "assistant", content: `Error: ${message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <header className="flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-3">
          <button
            aria-label="Toggle side pane"
            className="rounded-xl border px-3 py-2 hover:bg-gray-50"
            onClick={() => setOpen(v => !v)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-xl md:text-2xl font-semibold">
            What would you like to verify?
          </h1>
        </div>
        <PanelsTopLeft className="h-5 w-5 text-gray-400" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <section
          className={cn(
            "md:col-span-8 rounded-2xl border bg-white",
            "flex flex-col h-[70vh]"
          )}
        >
          <MessageList messages={messages} />
          <Composer disabled={busy} onSend={onSend} onUploadImage={onUploadImage} />
        </section>
        <aside
          className={cn(
            "md:col-span-4 rounded-2xl border bg-white h-[70vh] transition-all",
            open ? "opacity-100" : "opacity-0 md:hidden pointer-events-none"
          )}
        >
          <SidePane results={results} />
        </aside>
      </div>

      <footer className="mt-4 text-xs text-gray-600 flex items-center justify-between">
        <div>
          Engine: <span className="font-mono">{engineTag || "mvp-baselines-v1"}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {metrics?.map((m, i) => (
            <span key={`${m.key}-${i}`} className="font-mono">
              {m.key}: {String(m.value)}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
