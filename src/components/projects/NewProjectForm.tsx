"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  attachPendingProjectDocumentToProject,
  clearPendingProjectDocumentDraft,
  readPendingProjectDocumentDraft,
} from "@/lib/projects/documentMetadata";
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
  const manualModeRequested = searchParams.get("mode") === "manual";
  const [methods, setMethods] = useState<MethodOption[]>([]);
  const [reviewMode, setReviewMode] =
    useState<ProjectReviewMode>(
      manualModeRequested ? "manual" : "methodology-linked",
    );
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

  const groupedMethods = useMemo(
    () => groupMethodsByRegistry(methods),
    [methods],
  );
  const attachMatches = useMemo<ExistingProjectMatch[]>(
    () => documentDraft?.suggestedExistingProjects ?? [],
    [documentDraft],
  );
  const detectedProjectTitle =
    documentDraft?.fields.projectTitle.value?.trim() ||
    "No project title detected";
  const detectedMethod =
    documentDraft?.fields.methodology.value?.trim() || "No method detected";
  const detectedStandard =
    documentDraft?.fields.standard.value?.trim() || "No standard detected";
  const createModeActive = creationMode === "create";
  const searchKey = searchParams.toString();
  const manualOnlyView =
    manualModeRequested && !documentDraft && !handoffDetected;

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
    setDocumentDraft(stagedDraft);
    setName(stagedDraft.fields.projectTitle.value ?? "");
    setProjectCode(stagedDraft.fields.projectId.value ?? "");
    setCountryLocation(stagedDraft.fields.country.value ?? "");
    setProponent(stagedDraft.fields.proponent.value ?? "");
    setMethodology(stagedDraft.fields.methodology.value ?? "");
    setStandard(stagedDraft.fields.standard.value ?? "");
    setSourceDocumentType(stagedDraft.fields.documentType.value ?? "");
    setSourceDocumentVersion(stagedDraft.fields.version.value ?? "");
    setSourceDocumentDate(stagedDraft.fields.documentDate.value ?? "");
    const suggestedAttach = stagedDraft.suggestedExistingProjects[0];
    if (suggestedAttach) {
      setAttachProjectId(suggestedAttach.projectId);
    }
  }, [documentDraft?.source.attachmentId, searchKey, searchParams]);

  useEffect(() => {
    if (!documentDraft || !methods.length || selectedMethod) return;
    const maybeMethod = maybeSelectMethod(
      methods,
      documentDraft.fields.methodology.value,
    );
    if (maybeMethod) setSelectedMethod(maybeMethod);
  }, [documentDraft, methods, selectedMethod]);

  useEffect(() => {
    if (!manualOnlyView) return;
    setReviewMode("manual");
  }, [manualOnlyView]);

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
    } catch (error) {
      const fallbackMessage =
        reviewMode === "manual"
          ? "Failed to create manual review. Try again."
          : creationMode === "attach"
            ? "Failed to attach the document to the existing project. Try again."
            : "Failed to create project handoff. Try again.";
      setError(error instanceof Error && error.message ? error.message : fallbackMessage);
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 md:px-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {manualOnlyView ? "Set up review manually" : "Start Review"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {manualOnlyView
            ? "Create a project review without uploading a source document first. You can attach documents and evidence later."
            : "Upload a project document, review the detected details, then continue into the project review workspace."}
        </p>
      </div>

      {documentDraft ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">We found a project</div>
          <div className="mt-1">
            Review detected details from {documentDraft.source.fileName}, then
            confirm before continuing.
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Detected project
              </div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                {detectedProjectTitle}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Detected method
              </div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                {detectedMethod}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Detected standard
              </div>
              <div className="mt-1 text-sm font-medium text-slate-900">
                {detectedStandard}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!manualOnlyView ? (
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

        {handoffDetected ? (
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
                onClick={() => setCreationMode("create")}
                className={`rounded-lg border px-4 py-3 text-left ${creationMode === "create" ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700"}`}
              >
                <div className="text-sm font-semibold">
                  Start review from this document
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Create a review workspace using the detected details below.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setCreationMode("attach")}
                disabled={!attachMatches.length}
                className={`rounded-lg border px-4 py-3 text-left ${creationMode === "attach" ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700"} ${!attachMatches.length ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <div className="text-sm font-semibold">
                  Attach to existing project
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Use this secondary path when the document matches an existing
                  review workspace.
                </div>
              </button>
            </div>

            {attachMatches.length ? (
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

        {createModeActive ? (
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
                  : manualOnlyView
                    ? "This setup does not require a methodology selection before creating the project review. You can attach documents and evidence later."
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
                    {field.value || "No value extracted"}
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
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading
            ? creationMode === "attach"
              ? "Attaching..."
              : "Creating..."
            : creationMode === "attach"
              ? "Continue with this document"
              : documentDraft
                ? "Start Review"
                : "Create Project Review"}
        </button>
      </form>
    </div>
  );
}
