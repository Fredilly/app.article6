import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const version = searchParams.get('version');

  if (!code || !version) {
    return NextResponse.json({ error: 'Missing code or version' }, { status: 400 });
  }

  try {
    // Load from manifest (faster, already indexed)
    const manifestPath = path.join(process.cwd(), 'public', 'manifest', 'index.json');
    const raw = await readFile(manifestPath, 'utf8');
    const entries = JSON.parse(raw);

    const rules = entries
      .filter((e: Record<string, unknown>) => e.methodology === code && e.version === version)
      .map((e: Record<string, unknown>) => ({
        id: e.rule_id || e.id,
        title: e.rule || e.title || '',
        sectionId: e.sectionId || '',
      }));

    return NextResponse.json({ rules });
  } catch (err) {
    return NextResponse.json({ rules: [], error: String(err) });
  }
}
