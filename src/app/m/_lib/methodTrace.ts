import { loadMethodRules } from "@/app/m/_lib/methodRules";
import { loadMethodSections } from "@/app/m/_lib/methodSections";
import { buildTraceIndex, type TraceIndex } from "@/lib/trace/traceIndex";

type TraceResult = {
  trace: TraceIndex;
  source: { rules: string; sections: string };
};

export async function loadMethodTrace(code: string, version: string): Promise<TraceResult | null> {
  const normalizedCode = code.trim();
  const normalizedVersion = version.trim();
  if (!normalizedCode || !normalizedVersion) return null;

  const rulesResult = await loadMethodRules(normalizedCode, normalizedVersion);
  const sectionsResult = await loadMethodSections(normalizedCode, normalizedVersion);

  const rules = Array.from(rulesResult.byId.values());
  const sections = Array.from(sectionsResult.byId.values());

  const trace = buildTraceIndex({
    method: { code: normalizedCode, version: normalizedVersion },
    rules,
    sections,
  });

  return {
    trace,
    source: { rules: rulesResult.source, sections: sectionsResult.source },
  };
}
