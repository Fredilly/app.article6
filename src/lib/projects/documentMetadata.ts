import { getAttachmentBytes } from "@/lib/proofMap/attachments";
import { addProjectDocument, listProjects } from "@/lib/projects/storage";
import type {
  ExistingProjectMatch,
  MetadataConfidence,
  Project,
  ProjectDocumentMetadataDraft,
  ProjectMetadataField,
  ProjectMetadataFieldKey,
  ProjectMetadataFieldProvenance,
} from "@/lib/projects/types";

const PENDING_DOCUMENT_DRAFT_KEY = "article6:pending-project-document-draft";

type ExtractedPage = {
  pageNumber: number;
  text: string;
};

type MatchCandidate = {
  value: string;
  confidence: MetadataConfidence;
  page: number;
  excerpt: string;
};

const FIELD_LABELS: Record<ProjectMetadataFieldKey, string> = {
  projectTitle: "Project Title",
  country: "Country",
  projectId: "Registry / Project ID",
  methodology: "Methodology",
  standard: "Standard",
  proponent: "Proponent",
  documentType: "Document Type",
  version: "Version",
  documentDate: "Document Date",
};

const COUNTRIES = [
  "Malawi", "Kenya", "Ghana", "Colombia", "Brazil", "India", "Indonesia", "Vietnam", "Peru", "Mexico",
  "Tanzania", "Uganda", "Rwanda", "Ethiopia", "Zambia", "Cambodia", "Laos", "Nepal", "Philippines", "Thailand",
];

function nowIso(): string {
  return new Date().toISOString();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForMatch(value: string): string {
  return normalizeWhitespace(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function confidenceFromScore(score: number): MetadataConfidence {
  if (score >= 0.9) return "high";
  if (score >= 0.72) return "medium";
  if (score > 0) return "low";
  return "missing";
}

function buildField(
  key: ProjectMetadataFieldKey,
  source: ProjectDocumentMetadataDraft["source"],
  candidate?: MatchCandidate,
): ProjectMetadataField {
  const provenance: ProjectMetadataFieldProvenance | null = candidate
    ? {
        attachmentId: source.attachmentId,
        fileName: source.fileName,
        page: candidate.page,
        pageRange: String(candidate.page),
        excerpt: candidate.excerpt,
      }
    : null;
  return {
    key,
    label: FIELD_LABELS[key],
    value: candidate?.value,
    confidence: candidate?.confidence ?? "missing",
    provenance,
  };
}

function excerptAround(line: string, value: string): string {
  const normalizedLine = normalizeWhitespace(line);
  const index = normalizedLine.toLowerCase().indexOf(value.toLowerCase());
  if (index < 0) return normalizedLine.slice(0, 200);
  const start = Math.max(0, index - 32);
  const end = Math.min(normalizedLine.length, index + value.length + 80);
  return normalizedLine.slice(start, end).trim();
}

function matchLabeledValue(page: ExtractedPage, patterns: RegExp[], confidence: MetadataConfidence): MatchCandidate | undefined {
  const lines = page.text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = pattern.exec(line);
      if (!match?.[1]) continue;
      const value = normalizeWhitespace(match[1]);
      if (!value) continue;
      return {
        value,
        confidence,
        page: page.pageNumber,
        excerpt: excerptAround(line, value),
      };
    }
  }
  return undefined;
}

function detectProjectTitle(pages: ExtractedPage[]): MatchCandidate | undefined {
  for (const page of pages.slice(0, 3)) {
    const lines = page.text.split(/\n+/).map((line) => normalizeWhitespace(line)).filter(Boolean);
    for (const line of lines.slice(0, 12)) {
      if (line.length < 12 || line.length > 180) continue;
      if (/^(project design document|monitoring report|verification report|vcs|verra|gold standard|table of contents)\b/i.test(line)) continue;
      if (/^[A-Z0-9 .,&()'/-]+$/.test(line) || /project|redd|forest|mangrove|cookstove|arr|afolu/i.test(line)) {
        return { value: line, confidence: "medium", page: page.pageNumber, excerpt: line };
      }
    }
  }
  return undefined;
}

function detectCountry(pages: ExtractedPage[]): MatchCandidate | undefined {
  for (const page of pages.slice(0, 5)) {
    const labeled = matchLabeledValue(page, [
      /\bhost country\s*[:\-]\s*(.+)$/i,
      /\bcountry(?:\/location)?\s*[:\-]\s*(.+)$/i,
      /\blocation\s*[:\-]\s*(.+)$/i,
    ], "high");
    if (labeled) return labeled;
    for (const country of COUNTRIES) {
      const regex = new RegExp(`\\b${country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      const line = page.text.split(/\n+/).find((entry) => regex.test(entry));
      if (line) return { value: country, confidence: "low", page: page.pageNumber, excerpt: excerptAround(line, country) };
    }
  }
  return undefined;
}

function detectProjectId(pages: ExtractedPage[]): MatchCandidate | undefined {
  for (const page of pages.slice(0, 5)) {
    const labeled = matchLabeledValue(page, [
      /\b(?:project|registry)\s*(?:id|number|ref(?:erence)?)\s*[:\-]\s*([A-Z0-9][A-Z0-9._/-]{2,})/i,
    ], "high");
    if (labeled) return labeled;
    const line = page.text.split(/\n+/).find((entry) => /\b(?:VCS|GS|CDM|UNFCCC|VCS-)\s*[-/]?\d{2,}\b/i.test(entry));
    const raw = line?.match(/\b(?:VCS|GS|CDM|UNFCCC|VCS-)\s*[-/]?\d{2,}\b/i)?.[0];
    if (line && raw) return { value: normalizeWhitespace(raw), confidence: "medium", page: page.pageNumber, excerpt: excerptAround(line, raw) };
  }
  return undefined;
}

function detectMethodology(pages: ExtractedPage[]): MatchCandidate | undefined {
  for (const page of pages.slice(0, 5)) {
    const labeled = matchLabeledValue(page, [
      /\b(?:applied )?methodology\s*[:\-]\s*(.+)$/i,
      /\bmethodological approach\s*[:\-]\s*(.+)$/i,
    ], "high");
    if (labeled) return labeled;
    const line = page.text.split(/\n+/).find((entry) => /\b(?:VM|VMD|AMS|ACM|AR-ACM)\d{3,4}\b/i.test(entry));
    const raw = line?.match(/\b(?:VM|VMD|AMS|ACM|AR-ACM)\d{3,4}\b/i)?.[0];
    if (line && raw) return { value: normalizeWhitespace(raw), confidence: "medium", page: page.pageNumber, excerpt: excerptAround(line, raw) };
  }
  return undefined;
}

function detectStandard(pages: ExtractedPage[]): MatchCandidate | undefined {
  for (const page of pages.slice(0, 4)) {
    const labeled = matchLabeledValue(page, [
      /\bstandard\s*[:\-]\s*(.+)$/i,
    ], "high");
    if (labeled) return labeled;
    const line = page.text.split(/\n+/).find((entry) => /\b(?:VCS Standard|Gold Standard|CCB(?: Standard)?|Article 6)\b/i.test(entry));
    const raw = line?.match(/\b(?:VCS Standard[^,\n]*|Gold Standard[^,\n]*|CCB(?: Standard)?[^,\n]*|Article 6[^,\n]*)/i)?.[0];
    if (line && raw) return { value: normalizeWhitespace(raw), confidence: "medium", page: page.pageNumber, excerpt: excerptAround(line, raw) };
  }
  return undefined;
}

function detectProponent(pages: ExtractedPage[]): MatchCandidate | undefined {
  for (const page of pages.slice(0, 5)) {
    const labeled = matchLabeledValue(page, [
      /\b(?:project )?proponent\s*[:\-]\s*(.+)$/i,
      /\bproject developer\s*[:\-]\s*(.+)$/i,
    ], "high");
    if (labeled) return labeled;
  }
  return undefined;
}

function detectDocumentType(pages: ExtractedPage[], fileName: string): MatchCandidate | undefined {
  const firstPage = pages[0];
  const haystack = `${fileName}\n${firstPage?.text ?? ""}`;
  const types = [
    "Project Design Document",
    "Monitoring Report",
    "Verification Report",
    "Validation Report",
    "Quick Check Evidence",
  ];
  for (const type of types) {
    if (new RegExp(type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(haystack)) {
      return {
        value: type,
        confidence: /quick check/i.test(type) ? "low" : "high",
        page: firstPage?.pageNumber ?? 1,
        excerpt: excerptAround(firstPage?.text ?? fileName, type),
      };
    }
  }
  if (/\.pdf$/i.test(fileName)) {
    return { value: "PDF evidence document", confidence: "low", page: 1, excerpt: fileName };
  }
  return undefined;
}

function detectVersion(pages: ExtractedPage[]): MatchCandidate | undefined {
  for (const page of pages.slice(0, 5)) {
    const labeled = matchLabeledValue(page, [
      /\bversion\s*[:\-]\s*([A-Z0-9._ -]{1,40})$/i,
      /\brev(?:ision)?\s*[:\-]\s*([A-Z0-9._ -]{1,40})$/i,
    ], "high");
    if (labeled) return labeled;
  }
  return undefined;
}

function detectDocumentDate(pages: ExtractedPage[]): MatchCandidate | undefined {
  const datePattern = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4})\b/;
  for (const page of pages.slice(0, 5)) {
    const labeled = matchLabeledValue(page, [
      /\b(?:document )?date\s*[:\-]\s*(.+)$/i,
      /\bissue date\s*[:\-]\s*(.+)$/i,
      /\bprepared on\s*[:\-]\s*(.+)$/i,
    ], "high");
    if (labeled) return labeled;
    const line = page.text.split(/\n+/).find((entry) => /\b(?:date|issued|prepared)\b/i.test(entry) && datePattern.test(entry));
    const raw = line?.match(datePattern)?.[1];
    if (line && raw) return { value: normalizeWhitespace(raw), confidence: "medium", page: page.pageNumber, excerpt: excerptAround(line, raw) };
  }
  return undefined;
}

function tokenize(value: string): Set<string> {
  return new Set(normalizeForMatch(value).split(" ").filter((token) => token.length > 2));
}

function computeExistingProjectMatches(projects: Project[], title?: string, projectCode?: string): ExistingProjectMatch[] {
  const titleTokens = tokenize(title ?? "");
  const normalizedCode = normalizeForMatch(projectCode ?? "");
  return projects
    .map((project) => {
      let score = 0;
      const reasons: string[] = [];
      if (normalizedCode && normalizeForMatch(project.projectCode ?? "") === normalizedCode) {
        score = Math.max(score, 0.99);
        reasons.push(`Project code matches ${project.projectCode}`);
      }
      const projectTokens = tokenize(project.name);
      const overlap = Array.from(titleTokens).filter((token) => projectTokens.has(token)).length;
      const union = new Set([...titleTokens, ...projectTokens]).size || 1;
      const nameScore = overlap / union;
      if (nameScore >= 0.55) {
        score = Math.max(score, 0.55 + nameScore * 0.4);
        reasons.push(`Project name overlaps on ${overlap} key terms`);
      }
      return {
        projectId: project.id,
        projectName: project.name,
        projectCode: project.projectCode,
        score,
        confidence: confidenceFromScore(score),
        matchReasons: reasons,
      } satisfies ExistingProjectMatch;
    })
    .filter((match) => match.score >= 0.72)
    .sort((a, b) => b.score - a.score || a.projectName.localeCompare(b.projectName))
    .slice(0, 3);
}

async function extractPdfPages(input: { bytes: ArrayBuffer; fileName: string }): Promise<ExtractedPage[]> {
  const response = await fetch("/api/quick-check/pdf-extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "x-article6-filename": encodeURIComponent(input.fileName),
    },
    body: input.bytes,
  });
  if (!response.ok) throw new Error(`PDF extraction failed with ${response.status}`);
  const payload = (await response.json()) as { pages?: Array<{ pageNumber?: number; text?: string }>; text?: string };
  if (Array.isArray(payload.pages) && payload.pages.length > 0) {
    return payload.pages
      .map((page, index) => ({
        pageNumber: typeof page.pageNumber === "number" ? page.pageNumber : index + 1,
        text: String(page.text ?? "").trim(),
      }))
      .filter((page) => page.text);
  }
  return [{ pageNumber: 1, text: String(payload.text ?? "").trim() }].filter((page) => page.text);
}

export async function buildProjectDocumentMetadataDraft(input: {
  origin: ProjectDocumentMetadataDraft["source"]["origin"];
  evidenceId: string;
  attachmentId: string;
  fileName: string;
  mimeType: string;
  contentSha256?: string;
}): Promise<ProjectDocumentMetadataDraft> {
  const bytes = await getAttachmentBytes(input.attachmentId);
  if (!bytes) throw new Error("Source attachment bytes are unavailable.");
  const pages = await extractPdfPages({ bytes, fileName: input.fileName });
  const source: ProjectDocumentMetadataDraft["source"] = {
    ...input,
    extractedAt: nowIso(),
  };
  const title = detectProjectTitle(pages);
  const projectId = detectProjectId(pages);
  const draft: ProjectDocumentMetadataDraft = {
    source,
    fields: {
      projectTitle: buildField("projectTitle", source, title),
      country: buildField("country", source, detectCountry(pages)),
      projectId: buildField("projectId", source, projectId),
      methodology: buildField("methodology", source, detectMethodology(pages)),
      standard: buildField("standard", source, detectStandard(pages)),
      proponent: buildField("proponent", source, detectProponent(pages)),
      documentType: buildField("documentType", source, detectDocumentType(pages, input.fileName)),
      version: buildField("version", source, detectVersion(pages)),
      documentDate: buildField("documentDate", source, detectDocumentDate(pages)),
    },
    suggestedExistingProjects: computeExistingProjectMatches(
      listProjects(),
      title?.value,
      projectId?.value,
    ),
  };
  return draft;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage ?? null;
}

export function stagePendingProjectDocumentDraft(draft: ProjectDocumentMetadataDraft): void {
  getStorage()?.setItem(PENDING_DOCUMENT_DRAFT_KEY, JSON.stringify(draft));
}

export function readPendingProjectDocumentDraft(): ProjectDocumentMetadataDraft | null {
  const raw = getStorage()?.getItem(PENDING_DOCUMENT_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProjectDocumentMetadataDraft;
  } catch {
    return null;
  }
}

export function clearPendingProjectDocumentDraft(): void {
  getStorage()?.removeItem(PENDING_DOCUMENT_DRAFT_KEY);
}

export async function stageProjectDocumentDraftFromAttachment(input: {
  origin: ProjectDocumentMetadataDraft["source"]["origin"];
  evidenceId: string;
  attachmentId: string;
  fileName: string;
  mimeType: string;
  contentSha256?: string;
}): Promise<ProjectDocumentMetadataDraft> {
  const draft = await buildProjectDocumentMetadataDraft(input);
  stagePendingProjectDocumentDraft(draft);
  return draft;
}

export async function attachPendingProjectDocumentToProject(projectId: string): Promise<void> {
  const draft = readPendingProjectDocumentDraft();
  if (!draft) {
    throw new Error("No staged document draft is available.");
  }
  const bytes = await getAttachmentBytes(draft.source.attachmentId);
  if (!bytes) {
    throw new Error("The staged document attachment is unavailable.");
  }
  const project = listProjects().find((candidate) => candidate.id === projectId);
  if (!project) {
    throw new Error("The selected project no longer exists.");
  }
  if (project.status === "locked") {
    throw new Error("The selected project is locked and cannot accept new documents.");
  }
  const contentBase64 = arrayBufferToBase64(bytes);
  const updatedProject = addProjectDocument(projectId, {
    fileName: draft.source.fileName,
    mimeType: draft.source.mimeType,
    sizeBytes: bytes.byteLength,
    contentSha256: draft.source.contentSha256,
    contentBase64,
    extractedText: Object.values(draft.fields)
      .map((field) => field.provenance?.excerpt)
      .filter(Boolean)
      .join("\n"),
  });
  if (!updatedProject) {
    throw new Error("Failed to attach the staged document to the selected project.");
  }
}
