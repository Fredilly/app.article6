"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  CloudUpload,
  FileBadge2,
  FileText,
  GitBranch,
  ShieldCheck,
} from "lucide-react";
import {
  attachPendingProjectDocumentToProject,
  clearPendingProjectDocumentDraft,
  readPendingProjectDocumentDraft,
  stageProjectDocumentDraftFromAttachment,
} from "@/lib/projects/documentMetadata";
import { createAndStoreEvidenceAttachment } from "@/lib/proofMap/attachments";
import { createProject } from "@/lib/projects/storage";
import { projectRegistryFromMethodProgram } from "@/lib/projects/verificationReport";
import type {
  ExistingProjectMatch,
  ProjectDocumentMetadataDraft,
  ProjectRegistry,
  ProjectReviewMode,
} from "@/lib/projects/types";
import {
  importMethodologyReviewIntoProject,
  readPendingProjectReviewHandoff,
} from "@/lib/projects/reviewHandoff";

export type MethodOption = {
  code: string;
  program: string;
  version: string;
  ruleCount: number;
};

const REGISTRY_ORDER: ProjectRegistry[] = [
  "UNFCCC",
  "Verra",
  "Gold Standard",
  "Unknown",
];
type ProjectCreationMode = "create" | "attach";

function newIntakeEvidenceId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `project-intake-${crypto.randomUUID()}`;
  }
  return `project-intake-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function confidenceTone(
  confidence: ProjectDocumentMetadataDraft["fields"]["projectTitle"]["confidence"],
): string {
  if (confidence === "high")
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (confidence === "medium") return "border-sky-200 bg-sky-50 text-sky-800";
  if (confidence === "low")
    return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-100 text-slate-500";
}

function maybeSelectMethod(
  methods: MethodOption[],
  rawValue: string | undefined,
): string {
  const value = rawValue?.trim();
  if (!value) return "";
  const exact = methods.find(
    (method) => method.code.toLowerCase() === value.toLowerCase(),
  );
  if (exact) return `${exact.code}@${exact.version}`;
  const matched = methods.find((method) =>
    value.toLowerCase().includes(method.code.toLowerCase()),
  );
  return matched ? `${matched.code}@${matched.version}` : "";
}

export function groupMethodsByRegistry(
  methods: MethodOption[],
): Array<{ registry: ProjectRegistry; methods: MethodOption[] }> {
  const groups = new Map<ProjectRegistry, MethodOption[]>();
  for (const registry of REGISTRY_ORDER) groups.set(registry, []);
  for (const method of methods) {
    const registry = projectRegistryFromMethodProgram(method.program);
    const list = groups.get(registry);
    if (list) list.push(method);
    else groups.get("Unknown")!.push(method);
  }
  return REGISTRY_ORDER.map((registry) => ({
    registry,
    methods: groups.get(registry)!.sort((a, b) => a.code.localeCompare(b.code)),
  })).filter((group) => group.methods.length > 0);
}

export default function NewProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [methods, setMethods] = useState<MethodOption[]>([]);
  const [reviewMode, setReviewMode] =
    useState<ProjectReviewMode>("methodology-linked");
  const [name, setName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [countryLocation, setCountryLocation] = useState("");
  const [proponent, setProponent] = useState("");
  const [reportingPeriod, setReportingPeriod] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("");
  const [aoiLabel, setAoiLabel] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [handoffDetected, setHandoffDetected] = useState(false);
  const [handoffMethodLabel, setHandoffMethodLabel] = useState("");
  const [methodology, setMethodology] = useState("");
  const [standard, setStandard] = useState("");
  const [sourceDocumentType, setSourceDocumentType] = useState("");
  const [sourceDocumentVersion, setSourceDocumentVersion] = useState("");
  const [sourceDocumentDate, setSourceDocumentDate] = useState("");
  const [documentDraft, setDocumentDraft] =
    useState<ProjectDocumentMetadataDraft | null>(null);
  const [creationMode, setCreationMode] =
    useState<ProjectCreationMode>("create");
  const [confirmDocumentDraft, setConfirmDocumentDraft] = useState(false);
  const [attachProjectId, setAttachProjectId] = useState("");
  const [showManualSetup, setShowManualSetup] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);

  const groupedMethods = useMemo(
    () => groupMethodsByRegistry(methods),
    [methods],
  );
  const attachMatches = useMemo<ExistingProjectMatch[]>(
    () => documentDraft?.suggestedExistingProjects ?? [],
    [documentDraft],
  );
  const detectedSummaryFields = useMemo(
    () =>
      documentDraft
        ? [
            {
              label: "Detected project",
              value:
                documentDraft.fields.projectTitle.value?.trim() ||
                "Not detected",
            },
            {
              label: "Detected method",
              value:
                documentDraft.fields.methodology.value?.trim() ||
                "Not detected",
            },
            {
              label: "Detected standard",
              value:
                documentDraft.fields.standard.value?.trim() ||
                "Not detected",
            },
            {
              label: "Document type",
              value:
                documentDraft.fields.documentType.value?.trim() ||
                "Not detected",
            },
            {
              label: "Country",
              value: documentDraft.fields.country.value?.trim() || "Not detected",
            },
            {
              label: "Proponent",
              value:
                documentDraft.fields.proponent.value?.trim() || "Not detected",
            },
          ]
        : [],
    [documentDraft],
  );
  const detectedResultChips = useMemo(() => {
    if (!documentDraft) return [];
    const fields = Object.values(documentDraft.fields);
    const chips: string[] = [];
    if (fields.some((field) => field.confidence === "high")) {
      chips.push("High confidence");
    }
    if (documentDraft.fields.methodology.value?.trim()) {
      chips.push("Method suggested");
    }
    if (fields.some((field) => field.provenance)) {
      chips.push("Provenance captured");
    }
    return chips;
  }, [documentDraft]);
  const createModeActive = creationMode === "create";
  const searchKey = searchParams.toString();
  const intakeActive = !documentDraft && !handoffDetected && !showManualSetup;

  const hydrateDocumentDraft = useCallback(
    (stagedDraft: ProjectDocumentMetadataDraft) => {
      setDocumentDraft(stagedDraft);
      setCreationMode("create");
      setConfirmDocumentDraft(false);
      setEditingDetails(false);
      setShowManualSetup(true);
      setName(stagedDraft.fields.projectTitle.value ?? "");
      setProjectCode(stagedDraft.fields.projectId.value ?? "");
      setCountryLocation(stagedDraft.fields.country.value ?? "");
      setProponent(stagedDraft.fields.proponent.value ?? "");
      setMethodology(stagedDraft.fields.methodology.value ?? "");
      setStandard(stagedDraft.fields.standard.value ?? "");
      setSourceDocumentType(stagedDraft.fields.documentType.value ?? "");
      setSourceDocumentVersion(stagedDraft.fields.version.value ?? "");
      setSourceDocumentDate(stagedDraft.fields.documentDate.value ?? "");
      setReviewMode("methodology-linked");
      setAttachProjectId(
        stagedDraft.suggestedExistingProjects[0]?.projectId ?? "",
      );
    },
    [],
  );

  async function handleIntakeUpload(file: File | null) {
    if (!file) return;
    if (!isPdfFile(file)) {
      setError("Upload a PDF project document to start review.");
      return;
    }

    const evidenceId = newIntakeEvidenceId();
    setUploadingDocument(true);
    setError("");

    try {
      const attachmentResult = await createAndStoreEvidenceAttachment({
        pin_id: evidenceId,
        file,
      });
      if (!attachmentResult.ok) {
        setError(attachmentResult.message);
        return;
      }

      const stagedDraft = await stageProjectDocumentDraftFromAttachment({
        origin: "pdd-upload",
        evidenceId,
        attachmentId: attachmentResult.attachment.id,
        fileName: attachmentResult.attachment.filename,
        mimeType: attachmentResult.attachment.mime,
        contentSha256: attachmentResult.attachment.sha256,
      });
      hydrateDocumentDraft(stagedDraft);
      router.replace("/projects/new?handoff=document-metadata");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to detect project details from this document. Try again.",
      );
    } finally {
      setUploadingDocument(false);
      setDragActive(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }

  useEffect(() => {
    fetch("/api/projects/methods")
      .then((r) => r.json())
      .then((data) => setMethods(data.methods || []))
      .catch(() => setMethods([]));
  }, []);

  useEffect(() => {
    if (searchParams.get("handoff") !== "active-review") return;
    const handoff = readPendingProjectReviewHandoff();
    if (!handoff) return;
    setHandoffDetected(true);
    setReviewMode("methodology-linked");
    setSelectedMethod(
      `${handoff.source.methodCode}@${handoff.source.methodVersion}`,
    );
    setHandoffMethodLabel(
      `${handoff.source.methodCode} ${handoff.source.methodVersion}`,
    );
  }, [searchKey, searchParams]);

  useEffect(() => {
    if (searchParams.get("handoff") !== "document-metadata") return;
    const stagedDraft = readPendingProjectDocumentDraft();
    if (!stagedDraft) return;
    if (documentDraft?.source.attachmentId === stagedDraft.source.attachmentId)
      return;
    hydrateDocumentDraft(stagedDraft);
  }, [
    documentDraft?.source.attachmentId,
    hydrateDocumentDraft,
    searchKey,
    searchParams,
  ]);

  useEffect(() => {
    if (!documentDraft || !methods.length || selectedMethod) return;
    const maybeMethod = maybeSelectMethod(
      methods,
      documentDraft.fields.methodology.value,
    );
    if (maybeMethod) setSelectedMethod(maybeMethod);
  }, [documentDraft, methods, selectedMethod]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createModeActive && !name) return;
    if (
      createModeActive &&
      reviewMode === "methodology-linked" &&
      !selectedMethod
    )
      return;
    if (documentDraft && !confirmDocumentDraft) return;
    if (creationMode === "attach" && !attachProjectId) return;

    setLoading(true);
    setError("");

    try {
      if (creationMode === "attach") {
        await attachPendingProjectDocumentToProject(attachProjectId);
        clearPendingProjectDocumentDraft();
        router.push(`/projects/${attachProjectId}`);
        return;
      }

      if (reviewMode === "manual") {
        const project = createProject({
          name,
          projectCode: projectCode || undefined,
          countryLocation: countryLocation || undefined,
          proponent: proponent || undefined,
          methodology: methodology || undefined,
          standard: standard || undefined,
          sourceDocumentType: sourceDocumentType || undefined,
          sourceDocumentVersion: sourceDocumentVersion || undefined,
          sourceDocumentDate: sourceDocumentDate || undefined,
          reviewMode,
          reportingPeriod: reportingPeriod || undefined,
          aoiLabel: aoiLabel || undefined,
          description: description || undefined,
          createdFromDocumentDraft: documentDraft ?? undefined,
        });
        if (documentDraft) {
          await attachPendingProjectDocumentToProject(project.id);
          clearPendingProjectDocumentDraft();
        }
        router.push(`/projects/${project.id}`);
        return;
      }

      const handoff = handoffDetected
        ? readPendingProjectReviewHandoff()
        : null;
      const [code, version] = selectedMethod.split("@");
      const rulesRes = await fetch(
        `/api/projects/method-rules?code=${code}&version=${version}`,
      );
      const rulesData = await rulesRes.json();
      const rules = (rulesData.rules || []).filter(
        (r: { id?: string }) => r.id,
      );

      if (rules.length === 0) {
        setError(
          "No rules found for this methodology. Cannot create project review.",
        );
        setLoading(false);
        return;
      }

      const selectedMethodRecord = methods.find(
        (method) => `${method.code}@${method.version}` === selectedMethod,
      );
      const parts = (selectedMethodRecord?.program ?? "").split("/");
      const category = parts.length > 1 ? parts.slice(1).join("/") : undefined;
      if (
        handoff &&
        handoff.source.methodCode === code &&
        handoff.source.methodVersion === version
      ) {
        const result = importMethodologyReviewIntoProject({
          handoff,
          projectFields: {
            name,
            projectCode: projectCode || undefined,
            countryLocation: countryLocation || undefined,
            proponent: proponent || undefined,
            methodology: methodology || undefined,
            standard: standard || undefined,
            methodCategory: category,
            registry: projectRegistryFromMethodProgram(
              selectedMethodRecord?.program,
            ),
            reportingPeriod: reportingPeriod || undefined,
            aoiLabel: aoiLabel || undefined,
            description: description || undefined,
            sourceDocumentType: sourceDocumentType || undefined,
            sourceDocumentVersion: sourceDocumentVersion || undefined,
            sourceDocumentDate: sourceDocumentDate || undefined,
            createdFromDocumentDraft: documentDraft ?? undefined,
          },
          rules,
        });
        if (documentDraft) {
          await attachPendingProjectDocumentToProject(result.project.id);
          clearPendingProjectDocumentDraft();
        }
        router.push(result.href);
        return;
      }

      const project = createProject({
        name,
        projectCode: projectCode || undefined,
        countryLocation: countryLocation || undefined,
        proponent: proponent || undefined,
        methodology: methodology || undefined,
        standard: standard || undefined,
        reviewMode,
        methodCode: code,
        methodVersion: version,
        methodCategory: category,
        registry: projectRegistryFromMethodProgram(
          selectedMethodRecord?.program,
        ),
        reportingPeriod: reportingPeriod || undefined,
        aoiLabel: aoiLabel || undefined,
        description: description || undefined,
        sourceDocumentType: sourceDocumentType || undefined,
        sourceDocumentVersion: sourceDocumentVersion || undefined,
        sourceDocumentDate: sourceDocumentDate || undefined,
        createdFromDocumentDraft: documentDraft ?? undefined,
        ruleIds: rules.map(
          (r: { id: string; title: string; sectionId?: string }) => ({
            id: r.id,
            title: r.title,
            sectionId: r.sectionId || "",
          }),
        ),
      });

      if (documentDraft) {
        await attachPendingProjectDocumentToProject(project.id);
        clearPendingProjectDocumentDraft();
      }
      router.push(`/projects/${project.id}`);
    } catch {
      setError(
        reviewMode === "manual"
          ? "Failed to create manual review. Try again."
          : creationMode === "attach"
            ? "Failed to attach the document to the existing project. Try again."
            : "Failed to create project handoff. Try again.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 md:px-8 md:py-14">
      {intakeActive ? (
        <div className="mx-auto w-full max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            Start Review
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-[15px]">
            Upload a PDD, monitoring report, or evidence file. Article6 will
            detect the project, method, and next review step.
          </p>
          <div
            className={`mt-8 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] md:p-8`}
          >
            <div
              className={`rounded-[1.5rem] border-2 border-dashed px-6 py-12 text-center transition md:px-10 md:py-16 ${dragActive ? "border-sky-400 bg-sky-50" : "border-slate-300 bg-slate-50/80"}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              void handleIntakeUpload(event.dataTransfer.files?.[0] ?? null);
            }}
          >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <CloudUpload className="h-6 w-6" />
              </div>
              <div className="mt-5 text-xl font-semibold text-slate-950">
                Drag and drop your project document
              </div>
              <div className="mt-2 text-sm text-slate-500">
                PDF, DOCX, XLSX, GEOJSON, KML, SHP ZIP
              </div>
              <input
                ref={uploadInputRef}
                type="file"
                accept="application/pdf,.pdf,.doc,.docx,.xlsx,.geojson,.kml,.zip"
                className="hidden"
                onChange={(event) => {
                  void handleIntakeUpload(event.target.files?.[0] ?? null);
                }}
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={uploadingDocument}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <CloudUpload className="h-4 w-4" />
                {uploadingDocument
                  ? "Detecting project details..."
                  : "Upload project document"}
              </button>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualSetup(true);
                    setReviewMode("manual");
                    setError("");
                  }}
                  className="text-sm font-medium text-slate-600 underline-offset-4 transition hover:text-slate-900 hover:underline"
                >
                  Set up review manually
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  Detects project metadata
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                  <GitBranch className="h-4 w-4" />
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  Suggests methodology
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  Preserves provenance &amp; confidence
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`mx-auto w-full ${documentDraft ? "max-w-5xl text-center" : "max-w-3xl"}`}>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950">
            Start Review
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 md:text-[15px]">
            {documentDraft
              ? "We reviewed your uploaded document and found the most relevant project details."
              : "Upload a project document, review the detected details, then continue into the project review workspace."}
          </p>
        </div>
      )}

      {documentDraft ? (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700">
                <FileBadge2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-emerald-950">
                  {documentDraft.source.fileName}
                </div>
                <div className="text-xs text-emerald-800/80">
                  Uploaded and ready for review
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ready
              </span>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-6 text-sm text-slate-700 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] md:px-8 md:py-8">
            <div className="text-2xl font-semibold tracking-tight text-slate-950">
              We found a project
            </div>
            <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review the detected details, then continue into the review
              workspace.
            </div>
            {detectedResultChips.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {detectedResultChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {detectedSummaryFields.map((field) => (
              <div
                key={field.label}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {field.label}
                </div>
                <div className="mt-2 text-sm font-medium text-slate-900">
                  {field.value}
                </div>
              </div>
            ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-6 shadow-sm">
            <div className="text-base font-semibold text-slate-950">
              What happens next
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                "Confirm details",
                "Review evidence",
                "Export verification pack",
              ].map((step, index) => (
                <div
                  key={step}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Step {index + 1}
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-900">
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="mx-auto w-full max-w-4xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!intakeActive ? (
        <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          {!documentDraft || editingDetails ? (
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              {documentDraft ? "Review route" : "Review Type"}
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                disabled={handoffDetected}
                onClick={() => setReviewMode("methodology-linked")}
                className={`rounded-lg border px-4 py-3 text-left ${handoffDetected ? "cursor-not-allowed opacity-60" : ""} ${
                  reviewMode === "methodology-linked"
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <div className="text-sm font-semibold">
                  {documentDraft
                    ? "Continue with detected method"
                    : "Methodology-linked review"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {documentDraft
                    ? "Use the detected method and its rule set in the review workspace."
                    : "Use a selected methodology and its rule set."}
                </div>
              </button>
              <button
                type="button"
                disabled={handoffDetected}
                onClick={() => setReviewMode("manual")}
                className={`rounded-lg border px-4 py-3 text-left ${handoffDetected ? "cursor-not-allowed opacity-60" : ""} ${
                  reviewMode === "manual"
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <div className="text-sm font-semibold">
                  {documentDraft
                    ? "Continue without a linked method"
                    : "Manual Review"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {documentDraft
                    ? "Keep the document details, but continue without a detected method."
                    : "Project-level manual review / VVB findings reconstruction."}
                </div>
              </button>
            </div>
          </div>
          ) : null}

          {handoffDetected && (!documentDraft || editingDetails) ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Create a project and carry over the active review for{" "}
              {handoffMethodLabel}. Existing evidence links, rule reviews,
              reviewer notes, and draft finalization state will be imported.
            </div>
          ) : null}

          {documentDraft ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreationMode("create");
                    setEditingDetails(false);
                  }}
                  className={`rounded-lg border px-4 py-3 text-left ${creationMode === "create" ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700"}`}
                >
                  <div className="text-sm font-semibold">
                    Continue to review workspace
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Create a review workspace using the detected details above.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreationMode("attach");
                    setEditingDetails(false);
                  }}
                  disabled={!attachMatches.length}
                  className={`rounded-lg border px-4 py-3 text-left ${creationMode === "attach" ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700"} ${!attachMatches.length ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <div className="text-sm font-semibold">
                    Attach to existing project
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Use this secondary path when the document matches an
                    existing review workspace.
                  </div>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingDetails((current) => !current)}
                  className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  {editingDetails ? "Hide edit details" : "Edit details"}
                </button>
              </div>

              {attachMatches.length && creationMode === "attach" ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="mb-2 text-sm font-semibold text-slate-900">
                    Existing project matches
                  </div>
                  <div className="grid gap-2">
                    {attachMatches.map((match) => (
                      <label
                        key={match.projectId}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3"
                      >
                        <input
                          type="radio"
                          name="attach-project"
                          checked={attachProjectId === match.projectId}
                          onChange={() => setAttachProjectId(match.projectId)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">
                              {match.projectName}
                            </span>
                            {match.projectCode ? (
                              <span className="text-xs text-slate-500">
                                {match.projectCode}
                              </span>
                            ) : null}
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${confidenceTone(match.confidence)}`}
                            >
                              {match.confidence}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {match.matchReasons.join(" · ")}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {createModeActive && (!documentDraft || editingDetails) ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  {documentDraft ? "Project name" : "Project Name"}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Malawi Liwonde REDD+ Verification"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  required={createModeActive}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Project ID / Code
                  </label>
                  <input
                    type="text"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    placeholder="e.g., VCS-1530"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Reporting Period
                  </label>
                  <input
                    type="text"
                    value={reportingPeriod}
                    onChange={(e) => setReportingPeriod(e.target.value)}
                    placeholder="e.g., 2024-01-01 to 2024-12-31"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Country / Location
                  </label>
                  <input
                    type="text"
                    value={countryLocation}
                    onChange={(e) => setCountryLocation(e.target.value)}
                    placeholder="e.g., Malawi"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Proponent
                  </label>
                  <input
                    type="text"
                    value={proponent}
                    onChange={(e) => setProponent(e.target.value)}
                    placeholder="e.g., Article6 Climate"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    {documentDraft
                      ? "Detected method"
                      : "Methodology (document field)"}
                  </label>
                  <input
                    type="text"
                    value={methodology}
                    onChange={(e) => setMethodology(e.target.value)}
                    placeholder="e.g., VM0007"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Standard
                  </label>
                  <input
                    type="text"
                    value={standard}
                    onChange={(e) => setStandard(e.target.value)}
                    placeholder="e.g., VCS Standard v4.7"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Document Type
                  </label>
                  <input
                    type="text"
                    value={sourceDocumentType}
                    onChange={(e) => setSourceDocumentType(e.target.value)}
                    placeholder="e.g., Project Design Document"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Document Version
                  </label>
                  <input
                    type="text"
                    value={sourceDocumentVersion}
                    onChange={(e) => setSourceDocumentVersion(e.target.value)}
                    placeholder="e.g., v1.3"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Document Date
                  </label>
                  <input
                    type="text"
                    value={sourceDocumentDate}
                    onChange={(e) => setSourceDocumentDate(e.target.value)}
                    placeholder="e.g., 2026-05-24"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {reviewMode === "methodology-linked" ? (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    {documentDraft
                      ? "Confirm method before continuing"
                      : "Methodology"}
                  </label>
                  <select
                    value={selectedMethod}
                    onChange={(e) => setSelectedMethod(e.target.value)}
                    disabled={handoffDetected}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">
                      {documentDraft
                        ? "Select or confirm the detected method..."
                        : "Select a methodology..."}
                    </option>
                    {groupedMethods.map((group) => (
                      <optgroup key={group.registry} label={group.registry}>
                        {group.methods.map((m) => (
                          <option
                            key={`${m.code}@${m.version}`}
                            value={`${m.code}@${m.version}`}
                          >
                            {m.code} v{m.version} — {m.program} ({m.ruleCount}{" "}
                            rules)
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {documentDraft
                    ? "This route keeps the detected project details and document, but does not require you to confirm a method before continuing."
                    : "Manual Review does not require a methodology selection. Use this mode for project-specific findings reconstruction, evidence gaps, reviewer notes, and export."}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Area Label (optional)
                </label>
                <input
                  type="text"
                  value={aoiLabel}
                  onChange={(e) => setAoiLabel(e.target.value)}
                  placeholder="e.g., Liwonde National Park, Malawi"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the project review..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Continue with this document to attach it to the selected existing
              project. No new project name is required.
            </div>
          )}

          {documentDraft ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="mb-1 text-sm font-semibold text-slate-900">
                Review detected details
              </div>
              <div className="text-xs text-slate-500">
                Confirm before continuing. Every extracted field keeps its
                confidence label and provenance snippet.
              </div>
              <div className="mb-3" />
              <div className="grid gap-3">
                {Object.values(documentDraft.fields).map((field) => (
                  <div
                    key={field.key}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {field.label}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${confidenceTone(field.confidence)}`}
                      >
                        {field.confidence}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                      {field.value || "Not detected"}
                    </div>
                    {field.provenance ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {field.provenance.fileName} · page{" "}
                        {field.provenance.pageRange ||
                          field.provenance.page ||
                          "?"}
                        {field.provenance.excerpt
                          ? ` · "${field.provenance.excerpt}"`
                          : ""}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <label className="mt-4 flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={confirmDocumentDraft}
                  onChange={(event) =>
                    setConfirmDocumentDraft(event.target.checked)
                  }
                  className="mt-1"
                />
                <span>
                  I reviewed the detected details, confidence labels, and
                  provenance snippets and want to continue with this document.
                </span>
              </label>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={
              loading ||
              (creationMode === "create" &&
                (!name ||
                  (reviewMode === "methodology-linked" && !selectedMethod))) ||
              (creationMode === "attach" && !attachProjectId) ||
              Boolean(documentDraft && !confirmDocumentDraft)
            }
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {loading
              ? creationMode === "attach"
                ? "Attaching..."
                : "Creating..."
              : creationMode === "attach"
                ? "Continue with this document"
                : documentDraft
                  ? "Continue to review workspace"
                  : "Create Project Review"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
