import type { RuleSummary } from "@/app/m/_lib/methodRules";

export type QuickCheckMethodRecord = {
  code: string;
  versions: string[];
  latestVersion?: string;
};

export type QuickCheckCandidateLike = {
  key: string;
  methodologyId: string;
  methodologyVersion: string;
  requirementId: string;
  requirementLabel: string;
  score: number | null;
};

export type QuickCheckResolvedCandidate<TCandidate extends QuickCheckCandidateLike = QuickCheckCandidateLike> = TCandidate & {
  methodologyLabel: string;
  requirementLabel: string;
  rule: RuleSummary;
};

type QuickCheckRuleLoader = (methodologyId: string, methodologyVersion: string) => Promise<RuleSummary[]>;

function normalize(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function buildMethodologyLabel(methodologyId: string, methodologyVersion: string): string {
  return methodologyVersion ? `${methodologyId} · ${methodologyVersion}` : methodologyId;
}

export async function resolveQuickCheckCandidate<TCandidate extends QuickCheckCandidateLike>(input: {
  candidate: TCandidate;
  methods: QuickCheckMethodRecord[];
  loadRules: QuickCheckRuleLoader;
}): Promise<QuickCheckResolvedCandidate<TCandidate> | null> {
  const methodologyId = normalize(input.candidate.methodologyId);
  const methodologyVersion = normalize(input.candidate.methodologyVersion);
  const requirementId = normalize(input.candidate.requirementId);

  if (!methodologyId || !methodologyVersion || !requirementId) return null;

  const method = input.methods.find((entry) => normalize(entry.code) === methodologyId) ?? null;
  if (!method) return null;
  if (!Array.isArray(method.versions) || !method.versions.includes(methodologyVersion)) return null;

  const rules = await input.loadRules(methodologyId, methodologyVersion);
  const rule = rules.find((entry) => normalize(entry.id) === requirementId) ?? null;
  if (!rule) return null;

  return {
    ...input.candidate,
    methodologyId,
    methodologyVersion,
    requirementId: rule.id,
    methodologyLabel: buildMethodologyLabel(methodologyId, methodologyVersion),
    requirementLabel: `${rule.id} · ${rule.title}`,
    rule,
  };
}

export async function resolveQuickCheckCandidates<TCandidate extends QuickCheckCandidateLike>(input: {
  candidates: TCandidate[];
  methods: QuickCheckMethodRecord[];
  loadRules: QuickCheckRuleLoader;
}): Promise<Array<QuickCheckResolvedCandidate<TCandidate>>> {
  const resolved = await Promise.all(
    input.candidates.map((candidate) =>
      resolveQuickCheckCandidate({
        candidate,
        methods: input.methods,
        loadRules: input.loadRules,
      }),
    ),
  );

  return resolved.filter(Boolean) as Array<QuickCheckResolvedCandidate<TCandidate>>;
}
