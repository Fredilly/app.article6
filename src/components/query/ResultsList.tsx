import type { QueryResponse } from "@/lib/query/schema";
import MetricsTable from "./MetricsTable";
import ResultCard from "./ResultCard";

interface ResultsListProps {
  query: string;
  response: QueryResponse;
}

export default function ResultsList({ query, response }: ResultsListProps) {
  const hasResults = response.results && response.results.length > 0;
  const originalQuery = query || (response.meta?.query as string) || (response.meta?.text as string) || "(query unavailable)";

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,0.8fr)]">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Query</h2>
            <p className="text-base text-gray-900">{originalQuery}</p>
          </div>
          <MetricsTable metrics={response.metrics} />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Engine</h2>
          <dl className="mt-2 space-y-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tag</dt>
              <dd className="text-sm font-mono text-gray-800">{response.engineTag}</dd>
            </div>
            {response.warnings && response.warnings.length > 0 ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Warnings</dt>
                <dd className="space-y-1">
                  {response.warnings.map((warning, index) => (
                    <p className="rounded-lg bg-yellow-50 p-2 text-xs text-yellow-800" key={`${warning}-${index}`}>
                      {warning}
                    </p>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Results</h2>
        {hasResults ? (
          <div className="grid gap-3">
            {response.results.map((result, index) => (
              <ResultCard index={index} key={result.id ?? index} result={result} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            No evidence returned. Try another query or adjust parameters in the engine configuration.
          </p>
        )}
      </div>
    </section>
  );
}
