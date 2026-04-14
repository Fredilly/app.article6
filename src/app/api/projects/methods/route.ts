import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const manifestPath = path.join(process.cwd(), 'public', 'manifest', 'index.json');
    const raw = await readFile(manifestPath, 'utf8');
    const entries = JSON.parse(raw);

    const methodMap = new Map<string, { code: string; program: string; version: string; ruleCount: number }>();

    for (const entry of entries) {
      const code = entry.methodology || entry.method;
      const version = entry.version;
      const program = `${entry.provider || ''}/${entry.category || ''}`.replace(/^\//, '') || 'Unknown';
      const key = `${code}@${version}`;

      if (!methodMap.has(key)) {
        methodMap.set(key, { code, program, version, ruleCount: 0 });
      }
      methodMap.get(key)!.ruleCount++;
    }

    const methods = Array.from(methodMap.values()).sort((a, b) => a.code.localeCompare(b.code));
    return NextResponse.json({ methods });
  } catch {
    return NextResponse.json({ methods: [] });
  }
}
