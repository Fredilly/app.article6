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
import useDeeplinkMethodVersion from "@/hooks/useDeeplinkMethodVersion";

const DEFAULT_ENGINE_TAG = process.env.NEXT_PUBLIC_ENGINE_TAG ?? "mvp-baselines-v1";

export default function ChatApp() {
  const deeplink = useDeeplinkMethodVersion();
  const deeplinkWarnings = deeplink.resolved.warnings;
  const selectedMethod = deeplink.resolved.method;
  const selectedVersion = deeplink.resolved.resolvedVersion;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Welcome to Article6 — What would you like to explore? You can add an evidence map later; for now, chat is ready."
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-stone-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 md:px-8 md:py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              aria-label="Toggle insights"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 hover:shadow"
              onClick={() => setOpen(v => !v)}
            >
              <Menu className="h-5 w-5 text-gray-500" />
            </button>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Article 6 Evidence</p>
              <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">
                What would you like to explore today?
              </h1>
            </div>
          </div>
          <PanelsTopLeft className="h-6 w-6 text-gray-300" />
        </header>

        {selectedMethod || deeplinkWarnings.length ? (
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 text-sm text-gray-700 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Deeplink context
              </span>
              {deeplink.loading ? (
                <span className="text-xs text-gray-500">Loading…</span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
                method: {selectedMethod ?? "—"}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
                version: {selectedVersion ?? "—"}
              </span>
            </div>
            {deeplinkWarnings.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700">
                {deeplinkWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {hasMetrics ? (
          <div className="flex flex-wrap gap-2">
            {metricItems.map((m, i) => (
              <span
                key={`${m.key}-${i}`}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm"
              >
                <span className="text-gray-400">{m.key}</span>
                <span className="font-semibold text-gray-800">{String(m.value)}</span>
              </span>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,3.5fr)_minmax(0,2fr)]">
          <section
            className={cn(
              "flex h-[70vh] flex-col rounded-[1.5rem] border border-gray-200/70 bg-white/80 shadow-sm backdrop-blur lg:h-[72vh]",
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
            <SidePane
              results={results}
              contextMethod={selectedMethod}
              contextVersion={selectedVersion}
            />
          </aside>
        </div>

        <footer className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
          <div>
            Engine: <span className="font-mono">{engineTag || DEFAULT_ENGINE_TAG}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-gray-200 bg-white px-2 py-1 font-mono">
              {messages.length - 1} exchanges
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
