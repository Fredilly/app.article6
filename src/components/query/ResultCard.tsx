import { ExternalLink, FileText, Hash, Link as LinkIcon } from "lucide-react";
import type { JsonValue, QueryResult } from "@/lib/query/schema";
import { formatJsonValue } from "@/lib/query/format";

interface ResultCardProps {
  index: number;
  result: QueryResult;
}

function formatSourcePath(path?: string) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return (
      <a className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline" href={path} rel="noreferrer" target="_blank">
        <LinkIcon className="h-4 w-4" />
        <span>{path}</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }
  return <span className="text-sm text-gray-600">{path}</span>;
}

function toJsonValue(value: unknown): JsonValue {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => toJsonValue(item));
  }
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toJsonValue(entry)]));
  }
  return String(value);
}

function renderMetadata(metadata?: Record<string, JsonValue>) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }

  return (
    <dl className="grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
      {Object.entries(metadata).map(([key, value]) => (
        <div className="flex flex-col" key={key}>
          <dt className="font-medium text-gray-700">{key}</dt>
          <dd>{formatJsonValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ResultCard({ index, result }: ResultCardProps) {
  const { title, summary, snippet, sha256, sourcePath, url, pdfId, score, metadata } = result;
  const label = title?.trim() || result.id || `Result ${index + 1}`;

  const extraEntries = Object.entries(result as Record<string, unknown>).filter(([key]) =>
    ![
      "id",
      "title",
      "summary",
      "snippet",
      "sha256",
      "sourcePath",
      "url",
      "pdfId",
      "score",
      "metadata"
    ].includes(key)
  );

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
          {score !== undefined ? (
            <p className="text-xs text-gray-500">Score: {score.toFixed(4)}</p>
          ) : null}
        </div>
        {pdfId ? (
          <a
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            href={`/pdf/${encodeURIComponent(pdfId)}?download=1`}
            rel="noreferrer"
            target="_blank"
          >
            <FileText className="h-4 w-4" /> PDF
          </a>
        ) : null}
      </header>

      {summary ? <p className="text-sm text-gray-700">{summary}</p> : null}
      {snippet && summary !== snippet ? (
        <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">{snippet}</p>
      ) : null}

      {url ? (
        <a className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline" href={url} rel="noreferrer" target="_blank">
          <LinkIcon className="h-4 w-4" />
          <span>{url}</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}

      {sourcePath ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FileText className="h-4 w-4 text-gray-500" />
          {formatSourcePath(sourcePath)}
        </div>
      ) : null}

      {sha256 ? (
        <div className="flex items-center gap-2 text-xs font-mono text-gray-700">
          <Hash className="h-3 w-3" />
          <span>{sha256}</span>
        </div>
      ) : null}

      {metadata ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Metadata</h4>
          {renderMetadata(metadata)}
        </div>
      ) : null}

      {extraEntries.length > 0 ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Additional fields</h4>
          <dl className="grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
            {extraEntries.map(([key, value]) => (
              <div className="flex flex-col" key={key}>
                <dt className="font-medium text-gray-700">{key}</dt>
                <dd>{formatJsonValue(toJsonValue(value))}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </article>
  );
}
