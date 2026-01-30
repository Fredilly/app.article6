import { shortSha } from "@/lib/trustFormat";

type ProvenanceChipProps = {
  repo?: string | null;
  sha?: string | null;
  generatedAt?: string | null;
  onClick?: () => void;
};

function compactRepo(value: string | null | undefined): string {
  if (!value) return "provenance";
  const trimmed = value.trim();
  if (!trimmed) return "provenance";
  const parts = trimmed.split("/");
  return parts.length >= 2 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : trimmed;
}

export default function ProvenanceChip({ repo, sha, generatedAt, onClick }: ProvenanceChipProps) {
  const label = compactRepo(repo);
  const short = sha ? shortSha(sha) : "";
  const titleParts = [
    repo ? `repo: ${repo}` : null,
    sha ? `sha: ${sha}` : null,
    generatedAt ? `generated: ${generatedAt}` : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
      onClick={onClick}
      title={titleParts.length ? titleParts.join(" • ") : "Provenance"}
    >
      <span className="uppercase tracking-wide text-slate-500">{label}</span>
      {short ? <span className="font-mono text-slate-700">{short}</span> : null}
    </button>
  );
}
