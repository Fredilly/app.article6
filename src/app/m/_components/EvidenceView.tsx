import { readFile } from "node:fs/promises";
import path from "node:path";
import MethodDetailPane from "@/app/m/_components/MethodDetailPane";
import VerifyHeader from "@/app/m/_components/VerifyHeader";
import { getMethodInventory } from "@/app/m/_lib/methodInventory";
import { loadManifestEntries } from "@/lib/manifest/cards";
import packConfig from "../../../../config/methodologies_pack.json";

type EvidenceViewProps = {
  selectedCode: string;
  selectedVersion: string;
};

async function loadPackProvenanceJson(): Promise<unknown | null> {
  try {
    const filePath = path.join(process.cwd(), "public", "_provenance", "methodologies_PROVENANCE.json");
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function resolveManifestRulesPath(code: string, version: string): Promise<string | null> {
  const entries = await loadManifestEntries();
  const match = entries.find((entry) => entry.methodology === code && entry.version === version);
  if (!match) return null;
  const record = match as unknown as Record<string, unknown>;
  const manifestPath = typeof record.path === "string" ? record.path : null;
  return manifestPath && manifestPath.trim() ? manifestPath.trim() : null;
}

export default async function EvidenceView({ selectedCode, selectedVersion }: EvidenceViewProps) {
  const { methods } = await getMethodInventory();
  const normalizedCode = selectedCode.trim();
  const normalizedVersion = selectedVersion.trim();

  const selectedMethod =
    methods.find((method) => method.code.toLowerCase() === normalizedCode.toLowerCase()) ?? null;

  const effectiveVersion =
    normalizedVersion ||
    selectedMethod?.latestVersion ||
    selectedMethod?.versions.at(-1);

  const packProvenanceJson = await loadPackProvenanceJson();
  const manifestRulesPath =
    selectedMethod && effectiveVersion
      ? await resolveManifestRulesPath(selectedMethod.code, effectiveVersion)
      : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 md:px-8">
        <VerifyHeader />

        {selectedMethod && effectiveVersion ? (
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
            packTag={typeof packConfig?.tag === "string" ? packConfig.tag : null}
            provenanceJson={packProvenanceJson}
            manifestRulesPath={manifestRulesPath}
            mode="evidence"
          />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Verify</h2>
            <p className="mt-1 text-sm text-slate-600">
              Method {normalizedCode}@{normalizedVersion} was not found in the current inventory.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
