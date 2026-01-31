"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { IntakeItem, IntakeItemInput, IntakeStatus, PilotCadence } from "@/lib/intake/types";
import { addIntakeItem, loadIntakeRegistry, loadPilotCadence, savePilotCadence, updateIntakeItem } from "@/lib/intake/storage";

const STATUS_OPTIONS: IntakeStatus[] = ["new", "triaged", "in-progress", "done"];
const RECENCY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

function daysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function formatDate(value?: string | null): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function toDateInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toIsoDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

export default function IntakeDashboard() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<IntakeItem[]>([]);
  const [cadence, setCadence] = useState<PilotCadence>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [recencyFilter, setRecencyFilter] = useState<string>("all");
  const [form, setForm] = useState<IntakeItemInput>({
    method: "",
    version: "",
    rule_id: "",
    sectionId: "",
    type: "",
    description: "",
    status: "new",
    owner: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const queueRef = useRef<HTMLDivElement | null>(null);
  const prefillDoneRef = useRef(false);
  const pinnedRef = useRef({ method: "", version: "", rule_id: "", sectionId: "", type: "" });

  useEffect(() => {
    setItems(loadIntakeRegistry());
    setCadence(loadPilotCadence());
  }, []);

  useEffect(() => {
    if (prefillDoneRef.current) return;
    if (!searchParams) return;
    const params = {
      method: searchParams.get("method") ?? "",
      version: searchParams.get("version") ?? "",
      rule_id: searchParams.get("rule") ?? "",
      sectionId: searchParams.get("section") ?? "",
      type: searchParams.get("type") ?? "",
    };
    const hasAny = Object.values(params).some((value) => value);
    if (!hasAny) return;
    prefillDoneRef.current = true;
    pinnedRef.current = params;
    setForm((current) => ({
      ...current,
      ...Object.fromEntries(Object.entries(params).filter(([, value]) => value)),
    }));
  }, [searchParams]);

  const methods = useMemo(() => {
    const unique = new Set(items.map((item) => item.method));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    let next = [...items];
    if (statusFilter !== "all") {
      next = next.filter((item) => item.status === statusFilter);
    }
    if (methodFilter !== "all") {
      next = next.filter((item) => item.method === methodFilter);
    }
    if (recencyFilter !== "all") {
      const cutoff = recencyFilter === "7d" ? daysAgo(7) : recencyFilter === "30d" ? daysAgo(30) : daysAgo(90);
      next = next.filter((item) => {
        const stamp = new Date(item.created_at).getTime();
        return Number.isFinite(stamp) && stamp >= cutoff;
      });
    }
    return next.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [items, methodFilter, recencyFilter, statusFilter]);

  const handleCreate = () => {
    setFormError(null);
    if (!form.method.trim() || !form.version.trim() || !form.type.trim() || !form.description.trim()) {
      setFormError("Method, version, type, and description are required.");
      return;
    }
    const created = addIntakeItem({
      ...form,
      method: form.method.trim(),
      version: form.version.trim(),
      rule_id: form.rule_id?.trim() ? form.rule_id.trim() : null,
      sectionId: form.sectionId?.trim() ? form.sectionId.trim() : null,
      type: form.type.trim(),
      description: form.description.trim(),
      owner: form.owner?.trim() ? form.owner.trim() : null,
      status: form.status ?? "new",
    });
    setItems((current) => [created, ...current]);
    setToast("Intake item created");
    setHighlightId(created.id);
    window.setTimeout(() => setHighlightId((current) => (current === created.id ? null : current)), 1500);
    window.setTimeout(() => setToast((current) => (current === "Intake item created" ? null : current)), 1500);
    queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setForm({
      method: pinnedRef.current.method || form.method,
      version: pinnedRef.current.version || form.version,
      rule_id: pinnedRef.current.rule_id || "",
      sectionId: pinnedRef.current.sectionId || "",
      type: pinnedRef.current.type || "",
      description: "",
      status: "new",
      owner: form.owner ?? "",
    });
  };

  const handleStatusChange = (id: string, status: IntakeStatus) => {
    setItems(updateIntakeItem(id, { status }));
  };

  const handleCadenceChange = (key: keyof PilotCadence, value: string) => {
    const next = { ...cadence, [key]: toIsoDate(value) };
    setCadence(next);
    savePilotCadence(next);
    setToast("Cadence updated");
    window.setTimeout(() => setToast((current) => (current === "Cadence updated" ? null : current)), 1200);
  };

  const handleCreateSample = () => {
    const created = addIntakeItem({
      method: form.method.trim() || pinnedRef.current.method || "AR-ACM0003",
      version: form.version.trim() || pinnedRef.current.version || "v02-0",
      rule_id: pinnedRef.current.rule_id || "R-1-0001",
      sectionId: pinnedRef.current.sectionId || "S-1",
      type: pinnedRef.current.type || "ambiguous",
      description: "STAC evidence suggests mixed land-use classification; needs pilot review.",
      status: "new",
      owner: form.owner?.trim() || null,
    });
    setItems((current) => [created, ...current]);
    setToast("Sample intake item created");
    setHighlightId(created.id);
    window.setTimeout(() => setHighlightId((current) => (current === created.id ? null : current)), 1500);
    window.setTimeout(() => setToast((current) => (current === "Sample intake item created" ? null : current)), 1500);
    queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
      <div className="flex flex-col gap-6">
        {toast ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
            {toast}
          </div>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pilot loop</p>
            <h2 className="text-2xl font-semibold text-slate-900">Intake queue</h2>
            <p className="mt-1 text-sm text-slate-600">Track hard cases and close the pilot review loop.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pilot cadence</div>
            <div className="mt-1 text-xs text-slate-500">Set a review rhythm for pilot triage.</div>
            <div className="mt-2 grid gap-2 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">Last review</span>
                <span className="font-mono text-xs text-slate-800">{formatDate(cadence.last_review_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">Next review</span>
                <span className="font-mono text-xs text-slate-800">{formatDate(cadence.next_review_at)}</span>
              </div>
              <div className="grid gap-2 pt-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Update cadence</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={toDateInput(cadence.last_review_at)}
                    onChange={(event) => handleCadenceChange("last_review_at", event.target.value)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                  />
                  <input
                    type="date"
                    value={toDateInput(cadence.next_review_at)}
                    onChange={(event) => handleCadenceChange("next_review_at", event.target.value)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <div className="text-sm font-semibold text-slate-900">Create intake item</div>
            <div className="text-xs text-slate-500">Log hard cases when runs fail or look ambiguous.</div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Method
              <input
                value={form.method}
                onChange={(event) => setForm((current) => ({ ...current, method: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400"
                placeholder="AR-ACM0003"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Version
              <input
                value={form.version}
                onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400"
                placeholder="v02-0"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Rule ID (optional)
              <input
                value={form.rule_id ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, rule_id: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400"
                placeholder="R-1-0001"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Section ID (optional)
              <input
                value={form.sectionId ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, sectionId: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400"
                placeholder="S-1"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Type
              <input
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400"
                placeholder="ambiguous"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Owner (optional)
              <input
                value={form.owner ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400"
                placeholder="Verifier name"
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Short description
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-[90px] rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400"
              placeholder="Describe the hard case and why it needs pilot review."
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as IntakeStatus }))}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
              onClick={handleCreate}
            >
              Add intake item
            </button>
          </div>
          {formError ? <div className="text-xs font-semibold text-rose-600">{formError}</div> : null}
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Queue filters</div>
              <div className="text-xs text-slate-500">Filter intake items by status, method, and recency.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1"
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                value={methodFilter}
                onChange={(event) => setMethodFilter(event.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1"
              >
                <option value="all">All methods</option>
                {methods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              <select
                value={recencyFilter}
                onChange={(event) => setRecencyFilter(event.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1"
              >
                {RECENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div ref={queueRef} className="overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Case</span>
              <span>Method</span>
              <span>Status</span>
              <span>Created</span>
            </div>
            <div className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="text-sm font-semibold text-slate-900">No intake items yet</div>
                  <div className="mt-1 text-xs text-slate-500">Create one above or generate a sample for a quick demo.</div>
                  <button
                    type="button"
                    className="mt-4 rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                    onClick={handleCreateSample}
                  >
                    Create sample
                  </button>
                </div>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item.id}
                    data-new={highlightId === item.id ? "true" : undefined}
                    className={`grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-3 py-3 text-sm text-slate-700 ${
                      highlightId === item.id ? "bg-amber-50" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900">{item.type}</div>
                      <div className="truncate text-xs text-slate-500">{item.description}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        {item.rule_id ? <span>rule {item.rule_id}</span> : null}
                        {item.sectionId ? <span>section {item.sectionId}</span> : null}
                        {item.owner ? <span>owner {item.owner}</span> : null}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600">
                      <div>{item.method}</div>
                      <div className="text-[11px] text-slate-400">{item.version}</div>
                    </div>
                    <div>
                      <select
                        value={item.status}
                        onChange={(event) => handleStatusChange(item.id, event.target.value as IntakeStatus)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="text-xs text-slate-500">{formatDate(item.created_at)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
