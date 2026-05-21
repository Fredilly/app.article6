'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/lib/projects/storage';
import { projectRegistryFromMethodProgram } from '@/lib/projects/verificationReport';
import type { ProjectRegistry, ProjectReviewMode } from '@/lib/projects/types';

export type MethodOption = {
  code: string;
  program: string;
  version: string;
  ruleCount: number;
};

const REGISTRY_ORDER: ProjectRegistry[] = ['UNFCCC', 'Verra', 'Gold Standard', 'Unknown'];

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
  const [methods, setMethods] = useState<MethodOption[]>([]);
  const [reviewMode, setReviewMode] = useState<ProjectReviewMode>('methodology-linked');
  const [name, setName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [countryLocation, setCountryLocation] = useState('');
  const [proponent, setProponent] = useState('');
  const [reportingPeriod, setReportingPeriod] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [aoiLabel, setAoiLabel] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const groupedMethods = useMemo(() => groupMethodsByRegistry(methods), [methods]);

  useEffect(() => {
    fetch('/api/projects/methods')
      .then(r => r.json())
      .then(data => setMethods(data.methods || []))
      .catch(() => setMethods([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    if (reviewMode === 'methodology-linked' && !selectedMethod) return;

    setLoading(true);
    setError('');

    try {
      if (reviewMode === 'manual') {
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
        router.push(`/projects/${project.id}`);
        return;
      }

      const [code, version] = selectedMethod.split('@');
      const rulesRes = await fetch(`/api/projects/method-rules?code=${code}&version=${version}`);
      const rulesData = await rulesRes.json();
      const rules = (rulesData.rules || []).filter((r: { id?: string }) => r.id);

      if (rules.length === 0) {
        setError('No rules found for this methodology. Cannot create project review.');
        setLoading(false);
        return;
      }

      const selectedMethodRecord = methods.find((method) => `${method.code}@${method.version}` === selectedMethod);
      const parts = (selectedMethodRecord?.program ?? '').split('/');
      const category = parts.length > 1 ? parts.slice(1).join('/') : undefined;
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
          sectionId: r.sectionId || '',
        })),
      });

      router.push(`/projects/${project.id}`);
    } catch {
      setError(reviewMode === 'manual'
        ? 'Failed to create manual review. Try again.'
        : 'Failed to load methodology rules. Try again.');
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 md:px-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Project Review</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create a long-lived project review workspace
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Review Type</label>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setReviewMode('methodology-linked')}
              className={`rounded-lg border px-4 py-3 text-left ${
                reviewMode === 'methodology-linked'
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <div className="text-sm font-semibold">Methodology-linked review</div>
              <div className="mt-1 text-xs text-slate-500">Use a selected methodology and its rule set.</div>
            </button>
            <button
              type="button"
              onClick={() => setReviewMode('manual')}
              className={`rounded-lg border px-4 py-3 text-left ${
                reviewMode === 'manual'
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <div className="text-sm font-semibold">Manual Review</div>
              <div className="mt-1 text-xs text-slate-500">Project-level manual review / VVB findings reconstruction.</div>
            </button>
          </div>
        </div>

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

        {reviewMode === 'methodology-linked' ? (
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Methodology</label>
            <select
              value={selectedMethod}
              onChange={e => setSelectedMethod(e.target.value)}
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

        <button
          type="submit"
          disabled={loading || !name || (reviewMode === 'methodology-linked' && !selectedMethod)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Project Review'}
        </button>
      </form>
    </div>
  );
}
