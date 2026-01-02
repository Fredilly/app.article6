import Link from "next/link";
import FinderShell from "@/components/FinderShell";
import TrustStrip from "@/components/TrustStrip";
import VersionSelector from "@/app/m/_components/VersionSelector";
import { getMethodInventory } from "@/app/m/_lib/methodInventory";

type MethodsFinderProps = {
  selectedCode?: string;
  selectedVersion?: string;
};

function shortSha(value?: string): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 7);
}

export default async function MethodsFinder({ selectedCode, selectedVersion }: MethodsFinderProps) {
  const { methods, generatedAt, datasetHash } = await getMethodInventory();

  const normalizedCode = selectedCode?.trim();
  const selectedMethod = normalizedCode
    ? methods.find((method) => method.code.toLowerCase() === normalizedCode.toLowerCase()) ?? null
    : null;

  const effectiveVersion =
    selectedVersion?.trim() || selectedMethod?.latestVersion || selectedMethod?.versions.at(-1);

  const versionAuditHash =
    (selectedMethod && effectiveVersion
      ? selectedMethod.versionAuditHashes[effectiveVersion]
      : undefined) ?? undefined;

  const repoSha = selectedMethod?.source_sha ?? process.env.VERCEL_GIT_COMMIT_SHA ?? undefined;

  const auditHashes = [
    { label: "dataset_sha256", value: datasetHash },
    { label: "method_sha256", value: selectedMethod?.audit_hashes?.method_sha256 },
    { label: "version_sha256", value: versionAuditHash },
  ].filter((hash) => Boolean(hash.value));

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 md:px-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Method Inventory</h1>
          <p className="text-sm text-slate-600">
            Browse methods, select a version, and verify provenance via audit hashes.
          </p>
        </header>

        <TrustStrip
          methodCode={selectedMethod?.code}
          version={effectiveVersion}
          generatedAt={generatedAt}
          repoSha={repoSha}
          auditHashes={auditHashes}
        />

        <FinderShell
          left={
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">Methods</h2>
                <span className="text-xs text-slate-500">{methods.length} items</span>
              </div>
              <ul className="flex flex-col gap-2">
                {methods.map((method) => {
                  const active = selectedMethod?.code === method.code;
                  return (
                    <li key={method.code}>
                      <Link
                        href={`/m/${encodeURIComponent(method.code)}`}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                          active
                            ? "border-slate-300 bg-slate-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-mono text-sm text-slate-900">{method.code}</span>
                          <span className="text-xs text-slate-500">
                            {method.program} • {method.sector}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">{method.versionCount} v</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          }
          right={
            selectedMethod ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-sm font-semibold text-slate-900">{selectedMethod.code}</h2>
                    <p className="text-sm text-slate-600">
                      {selectedMethod.program} • {selectedMethod.sector}
                    </p>
                    <p className="text-xs text-slate-500">
                      Latest: {selectedMethod.latestVersion ?? "—"} • Repo: {shortSha(repoSha) ?? "—"}
                    </p>
                  </div>
                  <div className="w-full sm:max-w-xs">
                    <VersionSelector
                      methodCode={selectedMethod.code}
                      versions={selectedMethod.versions}
                      selectedVersion={selectedVersion}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    Detail pane placeholder (versions, rules, evidence anchors) — URL selection is refresh-safe.
                  </div>
                  {effectiveVersion ? (
                    <Link
                      href={`/m/${encodeURIComponent(selectedMethod.code)}/v/${encodeURIComponent(
                        effectiveVersion,
                      )}`}
                      className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
                    >
                      Open version route: /m/{selectedMethod.code}/v/{effectiveVersion}
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-900">Detail</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Select a method from the list to view details and version routes.
                </p>
              </div>
            )
          }
        />
      </div>
    </main>
  );
}

