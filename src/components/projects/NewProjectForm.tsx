'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/lib/projects/storage';

type MethodOption = {
  code: string;
  program: string;
  version: string;
  ruleCount: number;
};

export default function NewProjectForm() {
  const router = useRouter();
  const [methods, setMethods] = useState<MethodOption[]>([]);
  const [name, setName] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [aoiLabel, setAoiLabel] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/projects/methods')
      .then(r => r.json())
      .then(data => setMethods(data.methods || []))
      .catch(() => setMethods([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !selectedMethod) return;

    setLoading(true);
    const [code, version] = selectedMethod.split('@');

    const rulesRes = await fetch(`/api/projects/method-rules?code=${code}&version=${version}`);
    const rulesData = await rulesRes.json();

    const project = createProject({
      name,
      methodCode: code,
      methodVersion: version,
      aoiLabel: aoiLabel || undefined,
      description: description || undefined,
      ruleIds: (rulesData.rules || []).map((r: { id: string; title: string; sectionId?: string }) => ({
        id: r.id,
        title: r.title,
        sectionId: r.sectionId || '',
      })),
    });

    router.push(`/projects/${project.id}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 md:px-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Project</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create a verification project tied to a methodology
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Methodology</label>
          <select
            value={selectedMethod}
            onChange={e => setSelectedMethod(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            required
          >
            <option value="">Select a methodology...</option>
            {methods.map(m => (
              <option key={`${m.code}@${m.version}`} value={`${m.code}@${m.version}`}>
                {m.code} v{m.version} — {m.program} ({m.ruleCount} rules)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">AOI Label (optional)</label>
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
            placeholder="Brief description of the project..."
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !name || !selectedMethod}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Project'}
        </button>
      </form>
    </div>
  );
}
