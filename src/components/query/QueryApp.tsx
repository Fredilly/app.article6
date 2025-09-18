"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { sendQuery } from "@/lib/query/client";
import type { QueryResponse } from "@/lib/query/schema";
import QueryForm from "./QueryForm";
import ResultsList from "./ResultsList";

export default function QueryApp() {
  const [draft, setDraft] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const next = draft.trim();
    if (!next) {
      setError("Enter a question or evidence request to start.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await sendQuery(next);
      setResponse(result);
      setLastQuery(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Article 6 Evidence Explorer</h1>
          <p className="text-sm text-gray-600">
            Run deterministic queries against the packaged methodologies engine.
          </p>
        </div>
        {busy ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Searching engine…</span>
          </div>
        ) : response ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Search className="h-4 w-4" />
            <span>
              Engine: <strong>{response.engineTag}</strong>
            </span>
          </div>
        ) : null}
      </header>

      <QueryForm disabled={busy} onChange={setDraft} onSubmit={handleSubmit} value={draft} />

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      {response ? <ResultsList query={lastQuery} response={response} /> : null}
    </div>
  );
}
