"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  attachPendingProjectDocumentToProject,
  clearPendingProjectDocumentDraft,
  readPendingProjectDocumentDraft,
} from "@/lib/projects/documentMetadata";
import { createProject, updateProject } from "@/lib/projects/storage";
import { projectRegistryFromMethodProgram } from "@/lib/projects/verificationReport";
import type {
  ProjectDocumentMetadataDraft,
  ProjectRegistry,
  ProjectReviewMode,
} from "@/lib/projects/types";
import {
  buildProjectReviewHref,
  importMethodologyReviewIntoProject,
  readPendingProjectReviewHandoff,
} from "@/lib/projects/reviewHandoff";
import { ensureReviewWorkspace } from "@/lib/reviewWorkspaces/storage";

export type MethodOption = {
  code: string;
  program: string;
  version: string;
  ruleCount: number;
};

const REGISTRY_ORDER: ProjectRegistry[] = ["UNFCCC", "Verra", "Gold Standard", "Unknown"];

function confidenceTone(
  confidence: ProjectDocumentMetadataDraft["fields"]["projectTitle"]["confidence"],
): string {
  if (confidence === "high") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (confidence === "medium") return "border-sky-200 bg-sky-50 text-sky-800";
  if (confidence === "low") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-100 text-slate-500";
}

function maybeSelectMethod(methods: MethodOption[], rawValue: string | undefined): string {
  const value = rawValue?.trim();
  if (!value) return "";
  const exact = methods.find((method) => method.code.toLowerCase() === value.toLowerCase());
  if (exact) return `${exact.code}@${exact.version}`;
  const matched = methods.find((method) => value.toLowerCase().includes(method.code.toLowerCase()));
  return matched ? `${matched.code}@${matched.version}` : "";
}

export function groupMethodsByRegistry(methods: MethodOption[]): Array<{ registry: ProjectRegistry; methods: MethodOption[] }> {
  const groups = new Map<ProjectRegistry, MethodOption[]>();
  for (const registry of REGISTRY_ORDER) groups.set(registry, []);
  for (const method of methods) {
    const registry = projectRegistryFromMethodProgram(method.program);
    const list = groups.get(registry);
    if (list) list.push(method);
    else groups.get('Unknown')!.push(method);
  }
  return REGISTRY_ORDER
    .map((registry) => ({ registry, methods: groups.get(registry)!.sort((a, b) => a.code.localeCompare(b.code)) }))
    .filter((group) => group.methods.length > 0);
}

export default function NewProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const manualModeRequested = searchParams.get("mode") === "manual";
  const [methods, setMethods] = useState<MethodOption[]>([]);
  const [reviewMode, setReviewMode] = useState<ProjectReviewMode>(manualModeRequested ? "manual" : "methodology-linked");
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
  const [documentDraft, setDocumentDraft] = useState<ProjectDocumentMetadataDraft | null>(null);
  const [confirmDocumentDraft, setConfirmDocumentDraft] = useState(false);

  const groupedMethods = useMemo(() => groupMethodsByRegistry(methods), [methods]);
  const searchKey = searchParams.toString();
  const manualOnlyView = manualModeRequested && !documentDraft && !handoffDetected;
  const metadataFields = documentDraft ? [
    documentDraft.fields.projectTitle,
    documentDraft.fields.projectId,
    documentDraft.fields.country,
    documentDraft.fields.proponent,
    documentDraft.fields.methodology,
    documentDraft.fields.standard,
    documentDraft.fields.documentType,
    documentDraft.fields.documentDate,
  ] : [];

  useEffect(() => {
    fetch("/api/projects/methods")
      .then(r => r.json())
      .then(data => setMethods(data.methods || []))
      .catch(() => setMethods([]));
  }, []);

  useEffect(() => {
    if (searchParams.get("handoff") !== "active-review") return;
    const handoff = readPendingProjectReviewHandoff();
    if (!handoff) return;
    setHandoffDetected(true);
    setReviewMode("methodology-linked");
    setSelectedMethod(`${handoff.source.methodCode}@${handoff.source.methodVersion}`);
    setHandoffMethodLabel(`${handoff.source.methodCode} ${handoff.source.methodVersion}`);
  }, [searchKey, searchParams]);

  useEffect(() => {
    if (searchParams.get("handoff") !== "document-metadata") return;
    const stagedDraft = readPendingProjectDocumentDraft();
    if (!stagedDraft) return;
    if (documentDraft?.source.attachmentId === stagedDraft.source.attachmentId) return;
    setDocumentDraft(stagedDraft);
    setName(stagedDraft.fields.projectTitle.value ?? "");
    setProjectCode(stagedDraft.fields.projectId.value ?? "");
    setCountryLocation(stagedDraft.fields.country.value ?? "");
    setProponent(stagedDraft.fields.proponent.value ?? "");
  }, [documentDraft?.source.attachmentId, searchKey, searchParams]);

  useEffect(() => {
    if (!documentDraft || !methods.length || selectedMethod) return;
    const maybeMethod = maybeSelectMethod(methods, documentDraft.fields.methodology.value);
    if (maybeMethod) setSelectedMethod(maybeMethod);
  }, [documentDraft, methods, selectedMethod]);

  useEffect(() => {
    if (!manualOnlyView) return;
    setReviewMode("manual");
  }, [manualOnlyView]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    if (reviewMode === "methodology-linked" && !selectedMethod) return;
    if (documentDraft && !confirmDocumentDraft) return;

    setLoading(true);
    setError("");

    try {
      if (reviewMode === "manual") {
        const project = createProject({
          name,
          projectCode: projectCode || undefined,
          countryLocation: countryLocation || undefined,
          proponent: proponent || undefined,
          reviewMode,
          reportingPeriod: reportingPeriod || undefined,
          aoiLabel: aoiLabel || undefined,
          description: description || undefined,
        });
        if (documentDraft) {
          await attachPendingProjectDocumentToProject(project.id);
          clearPendingProjectDocumentDraft();
        }
        router.push(`/projects/${project.id}`);
        return;
      }

      const handoff = handoffDetected ? readPendingProjectReviewHandoff() : null;
      const [code, version] = selectedMethod.split("@");
      const rulesRes = await fetch(`/api/projects/method-rules?code=${code}&version=${version}`);
      const rulesData = await rulesRes.json();
      const rules = (rulesData.rules || []).filter((r: { id?: string }) => r.id);

      if (rules.length === 0) {
        setError("No rules found for this methodology. Cannot create project review.");
        setLoading(false);
        return;
      }

      const selectedMethodRecord = methods.find((method) => `${method.code}@${method.version}` === selectedMethod);
      const parts = (selectedMethodRecord?.program ?? "").split("/");
      const category = parts.length > 1 ? parts.slice(1).join('/') : undefined;
      if (handoff && handoff.source.methodCode === code && handoff.source.methodVersion === version) {
        const result = importMethodologyReviewIntoProject({
          handoff,
          projectFields: {
            name,
            projectCode: projectCode || undefined,
            countryLocation: countryLocation || undefined,
            proponent: proponent || undefined,
            methodCategory: category,
            registry: projectRegistryFromMethodProgram(selectedMethodRecord?.program),
            reportingPeriod: reportingPeriod || undefined,
            aoiLabel: aoiLabel || undefined,
            description: description || undefined,
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
        reviewMode,
        methodCode: code,
        methodVersion: version,
        methodCategory: category,
        registry: projectRegistryFromMethodProgram(selectedMethodRecord?.program),
        reportingPeriod: reportingPeriod || undefined,
        aoiLabel: aoiLabel || undefined,
        description: description || undefined,
        ruleIds: rules.map((r: { id: string; title: string; sectionId?: string }) => ({
          id: r.id,
          title: r.title,
          sectionId: r.sectionId || "",
        })),
      });
      const workspace = ensureReviewWorkspace({
        projectId: project.id,
        projectName: project.name,
        projectCode: project.projectCode,
        methodCode: code,
        methodVersion: version,
        reportingPeriod: project.reportingPeriod,
      });
      updateProject(project.id, { lastWorkspaceId: workspace.id });
      if (documentDraft) {
        await attachPendingProjectDocumentToProject(project.id);
        clearPendingProjectDocumentDraft();
      }
      router.push(buildProjectReviewHref({
        methodCode: code,
        methodVersion: version,
        projectId: project.id,
        workspaceId: workspace.id,
      }));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : reviewMode === "manual"
            ? "Failed to create manual review. Try again."
            : "Failed to create project handoff. Try again.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 md:px-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {manualOnlyView ? "Set up review manually" : documentDraft ? "Confirm Project Details" : "New Project Review"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {manualOnlyView
            ? "Create a project review without uploading a source document first. You can attach documents and evidence later."
            : documentDraft
              ? "Article6 detected project details from your document. Confirm them, then create the readiness workspace."
              : "Create a long-lived project review workspace"}
        </p>
      </div>

      {documentDraft ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">Detected from {documentDraft.source.fileName}</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {metadataFields.map((field) => (
              <div key={field.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {field.label}
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${confidenceTone(field.confidence)}`}>
                    {field.confidence}
                  </span>
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {field.value?.trim() || "Not detected"}
                </div>
                {field.provenance?.excerpt ? (
                  <div className="mt-2 text-xs leading-5 text-slate-500">
                    {field.provenance.excerpt}
                  </div>
                ) : null}
              </div>
            ))}
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
                  {documentDraft ? "Continue with detected method" : "Methodology-linked review"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {documentDraft
                    ? "Create a readiness workspace using the detected or selected methodology."
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
                  {documentDraft ? "Continue without a linked method" : "Manual Review"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {documentDraft
                    ? "Use this only if detection is wrong or you need a manual workspace."
                    : "Project-level manual review / VVB findings reconstruction."}
                </div>
              </button>
            </div>
          </div>
        ) : null}

        {handoffDetected ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Create a project and carry over the active review for {handoffMethodLabel}. Existing evidence links, rule reviews, reviewer notes, and draft finalization state will be imported.
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Project Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Malawi Liwonde REDD+ Verification"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Project ID / Code</label>
            <input
              type="text"
              value={projectCode}
              onChange={e => setProjectCode(e.target.value)}
              placeholder="e.g., VCS-1530"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Reporting Period</label>
            <input
              type="text"
              value={reportingPeriod}
              onChange={e => setReportingPeriod(e.target.value)}
              placeholder="e.g., 2024-01-01 to 2024-12-31"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Country / Location</label>
            <input
              type="text"
              value={countryLocation}
              onChange={e => setCountryLocation(e.target.value)}
              placeholder="e.g., Malawi"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Proponent</label>
            <input
              type="text"
              value={proponent}
              onChange={e => setProponent(e.target.value)}
              placeholder="e.g., Article6 Climate"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {reviewMode === "methodology-linked" ? (
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Methodology</label>
            <select
              value={selectedMethod}
              onChange={e => setSelectedMethod(e.target.value)}
              disabled={handoffDetected}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              required
            >
              <option value="">Select a methodology...</option>
              {groupedMethods.map(group => (
                <optgroup key={group.registry} label={group.registry}>
                  {group.methods.map(m => (
                    <option key={`${m.code}@${m.version}`} value={`${m.code}@${m.version}`}>
                      {m.code} v{m.version} — {m.program} ({m.ruleCount} rules)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {documentDraft?.fields.methodology.value ? (
              <p className="mt-2 text-xs text-slate-500">
                Detected in document: {documentDraft.fields.methodology.value}
              </p>
            ) : documentDraft ? (
              <p className="mt-2 text-xs text-slate-500">
                No method was detected. Select one manually to continue into the readiness workspace.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Manual Review does not require a methodology selection. Use this mode for project-specific findings reconstruction, evidence gaps, reviewer notes, and export.
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Area Label (optional)</label>
          <input
            type="text"
            value={aoiLabel}
            onChange={e => setAoiLabel(e.target.value)}
            placeholder="e.g., Liwonde National Park, Malawi"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Description (optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description of the project review..."
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {documentDraft ? (
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={confirmDocumentDraft}
              onChange={(event) => setConfirmDocumentDraft(event.target.checked)}
              className="mt-1"
            />
            <span>
              I confirmed these project details and want to continue into the readiness workspace.
            </span>
          </label>
        ) : null}

        <button
          type="submit"
          disabled={loading || !name || (reviewMode === "methodology-linked" && !selectedMethod) || Boolean(documentDraft && !confirmDocumentDraft)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading
            ? "Creating..."
            : documentDraft && reviewMode === "methodology-linked"
              ? "Create Readiness Workspace"
              : "Create Project Review"}
        </button>
      </form>
    </div>
  );
}
