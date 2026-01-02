import Link from "next/link";
import FinderShell from "@/components/FinderShell";
import TrustStrip from "@/components/TrustStrip";
import MethodDetailPane from "@/app/m/_components/MethodDetailPane";
import { getMethodInventory } from "@/app/m/_lib/methodInventory";

type MethodsFinderProps = {
  selectedCode?: string;
  selectedVersion?: string;
  selectedRuleId?: string;
};

export default async function MethodsFinder({
  selectedCode,
  selectedVersion,
  selectedRuleId,
}: MethodsFinderProps) {
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
  ];

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
              <MethodDetailPane
                method={{
                  code: selectedMethod.code,
                  program: selectedMethod.program,
                  sector: selectedMethod.sector,
                  versions: selectedMethod.versions,
                  latestVersion: selectedMethod.latestVersion,
                  versionCount: selectedMethod.versionCount,
                  hasRich: selectedMethod.hasRich,
                  hasPrevious: selectedMethod.hasPrevious,
                  ruleCountByVersion: selectedMethod.ruleCountByVersion,
                }}
                activeVersion={effectiveVersion}
                initialRuleId={selectedRuleId}
                generatedAt={generatedAt}
                repoSha={repoSha}
                datasetHash={datasetHash}
                methodHash={selectedMethod.audit_hashes?.method_sha256}
                versionHash={versionAuditHash}
              />
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
