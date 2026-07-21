export function clientFacingText(value: string): string {
  return value
    .replace(/Manual review replaced the machine-selected(?: truncated or mislocated)? evidence(?: for [^ ]+)? with PDF-backed evidence\.\s*/gi, "The reviewed evidence was assessed against the methodology requirement. ")
    .replace(/Manual review replaced the machine-selected evidence(?: for [^ ]+)? with PDF-backed evidence\.\s*/gi, "The reviewed evidence was assessed against the methodology requirement. ")
    .replace(/Manual re-adjudication corrected/gi, "The reviewed assessment corrected")
    .replace(/The blind audit confirms/gi, "The reviewed assessment confirms")
    .replace(/machine-selected/gi, "initially selected")
    .replace(/machine proposal/gi, "initial assessment")
    .replace(/machine-generated/gi, "automatically prepared")
    .replace(/truncated or mislocated evidence/gi, "incomplete evidence")
    .replace(/truncated evidence/gi, "incomplete evidence")
    .replace(/mislocated evidence/gi, "evidence that did not establish the requirement")
    .replace(/previous accepted quote/gi, "earlier evidence excerpt")
    .replace(/It was replaced with/gi, "The assessment relies on")
    .replace(/replaced the machine/gi, "updated the assessment")
    .replace(/corrected the machine/gi, "updated the assessment")
    .replace(/replaced with/gi, "updated to use")
    .replace(/re-adjudication/gi, "assessment review")
    .replace(/blind audit/gi, "reviewed assessment");
}

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isNearDuplicate(left: string, right: string): boolean {
  const normalizedLeft = normalizedText(left);
  const normalizedRight = normalizedText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;
  const leftWords = new Set(normalizedLeft.split(" "));
  const rightWords = new Set(normalizedRight.split(" "));
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  return overlap / Math.max(leftWords.size, rightWords.size) >= 0.85;
}

export function methodologyRequirement(title: string, requirement: string): string | undefined {
  const clientTitle = clientFacingText(title);
  const clientRequirement = clientFacingText(requirement);
  return isNearDuplicate(clientTitle, clientRequirement) ? undefined : clientRequirement;
}
