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

const DEFAULT_ENGINE_TAG = process.env.NEXT_PUBLIC_ENGINE_TAG ?? "mvp-baselines-v1";

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
  const [engineTag, setEngineTag] = useState<string>(DEFAULT_ENGINE_TAG);

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

  const metricItems = metrics.slice(0, 4);
  const hasMetrics = metricItems.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-5 md:px-6 md:py-8">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              aria-label="Toggle insights"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              onClick={() => setOpen(v => !v)}
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Article 6 Verification</p>
              <h1 className="text-lg text-slate-900 md:text-xl">
                What would you like to verify today?
              </h1>
            </div>
          </div>
          <PanelsTopLeft className="h-5 w-5 text-slate-300" />
        </header>

        {hasMetrics ? (
          <div className="flex flex-wrap gap-1.5">
            {metricItems.map((m, i) => (
              <span
                key={`${m.key}-${i}`}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] text-slate-600"
              >
                <span className="text-slate-400">{m.key}</span>
                <span className="text-slate-700">{String(m.value)}</span>
              </span>
            ))}
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,3.5fr)_minmax(0,2fr)]">
          <section
            className={cn(
              "flex h-[68vh] flex-col rounded-3xl border border-slate-200/70 bg-white/85 shadow-sm backdrop-blur lg:h-[70vh]",
            )}
          >
            <MessageList messages={messages} />
            <Composer disabled={busy} onSend={onSend} onUploadImage={onUploadImage} />
          </section>

          <aside
            className={cn(
              "lg:static lg:block",
              open ? "block" : "hidden lg:block"
            )}
          >
            <SidePane results={results} />
          </aside>
        </div>

        <footer className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div>
            Engine: <span className="font-mono">{engineTag || DEFAULT_ENGINE_TAG}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 font-mono">
              {messages.length - 1} exchanges
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
