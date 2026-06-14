import {
  SECTION_TOPICS,
  type SectionTopic,
  type SectionTopicMap,
  type TopicSelectionResult,
} from "@/lib/quickCheck/indexing/types";

function isSectionTopic(value: string): value is SectionTopic {
  return (SECTION_TOPICS as readonly string[]).includes(value);
}

export function findBestTopicMatch(
  topic: string,
  sectionTopicMap: SectionTopicMap,
  options: {
    minConfidence?: number;
    ambiguityMargin?: number;
  } = {},
): TopicSelectionResult {
  if (!isSectionTopic(topic)) {
    return { status: "no_evidence", reason: "unsupported_topic" };
  }

  const matches = [...sectionTopicMap[topic]].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const aPage = a.pageNumbers[0] ?? Number.MAX_SAFE_INTEGER;
    const bPage = b.pageNumbers[0] ?? Number.MAX_SAFE_INTEGER;
    if (aPage !== bPage) return aPage - bPage;
    return a.heading.localeCompare(b.heading);
  });

  if (matches.length === 0) {
    return { status: "no_evidence", reason: "no_topic_references" };
  }

  const minConfidence = options.minConfidence ?? 0.85;
  const ambiguityMargin = options.ambiguityMargin ?? 0.08;
  const best = matches[0];
  const second = matches[1];

  if (best.confidence < minConfidence) {
    return { status: "no_evidence", reason: "weak_match" };
  }
  // Ambiguity: reject when top two are close AND both are below
  // heading-level (0.95).  Multiple heading-level matches in the
  // same topic are expected in well-structured documents (e.g.
  // several stakeholder sections in a verification report).
  if (
    second
    && (best.confidence < 0.95 || second.confidence < 0.95)
    && (best.confidence - second.confidence) < ambiguityMargin
  ) {
    return { status: "no_evidence", reason: "ambiguous_match" };
  }

  return {
    status: "matched",
    reference: best,
  };
}
