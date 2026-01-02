import Link from "next/link";
import FinderShell from "@/components/FinderShell";
import TrustStrip from "@/components/TrustStrip";
import MethodDetailPane from "@/app/m/_components/MethodDetailPane";
import { getMethodInventory } from "@/app/m/_lib/methodInventory";
import { probeMethodRich } from "@/app/m/_lib/methodRich";
import { normalizeRichEvidence } from "@/lib/rich/normalize";

type MethodsFinderProps = {
  selectedCode?: string;
  selectedVersion?: string;
  selectedRuleId?: string;
  selectedSectionId?: string;
};

export default async function MethodsFinder({
  selectedCode,
  selectedVersion,
  selectedRuleId,
  selectedSectionId,
}: MethodsFinderProps) {
  const { methods, generatedAt, datasetHash } = await getMethodInventory();

  const findGoldenRichSelection = async () => {
    const maxMethods = 30;
    const maxVersionsPerMethod = 3;

    for (const method of methods.slice(0, maxMethods)) {
      const versions = [...method.versions].slice(-maxVersionsPerMethod).reverse();
      for (const version of versions) {
        const probe = await probeMethodRich(method.code, version);
        if (!probe.ok) continue;
        const normalized = normalizeRichEvidence(probe.data);
        const count =
          normalized.entities.length +
          normalized.tables.length +
          normalized.citations.length +
          normalized.diffs.length;
        if (count > 0) return { code: method.code, version };
      }
    }

    return null;
  };

  const normalizedCode = selectedCode?.trim();
  const goldenSelection =
    normalizedCode || selectedVersion ? null : await findGoldenRichSelection();
  const resolvedCode = normalizedCode ?? goldenSelection?.code;

  const selectedMethod = resolvedCode
    ? methods.find((method) => method.code.toLowerCase() === resolvedCode.toLowerCase()) ?? null
    : null;

  const effectiveVersion =
    selectedVersion?.trim() ||
    goldenSelection?.version ||
    selectedMethod?.latestVersion ||
    selectedMethod?.versions.at(-1);

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
          {!selectedCode && goldenSelection ? (
            <p className="text-xs text-slate-500">
              Rich demo auto-selected:{" "}
              <span className="font-mono">
                {goldenSelection.code}@{goldenSelection.version}
              </span>
            </p>
          ) : !selectedCode ? (
            <p className="text-xs text-slate-500">No rich-enabled versions detected in this dataset.</p>
          ) : null}
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
                initialSectionId={selectedSectionId}
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
