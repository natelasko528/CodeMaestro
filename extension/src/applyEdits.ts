import fs from 'node:fs/promises';
import path from 'node:path';
import { assertSafeRelativePath, resolveInside } from './paths';
import type { ProposedEdit } from './protocol';

export async function applyProposedEdits(params: {
  workspaceRoot: string;
  edits: ProposedEdit[];
}): Promise<{ applied: boolean; fileResults: Array<{ filePath: string; ok: boolean; error: string | null }> }> {
  const results: Array<{ filePath: string; ok: boolean; error: string | null }> = [];

  for (const e of params.edits) {
    try {
      assertSafeRelativePath(e.filePath);
      const abs = resolveInside(params.workspaceRoot, e.filePath);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, e.newText, 'utf8');
      results.push({ filePath: e.filePath, ok: true, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ filePath: e.filePath, ok: false, error: msg });
    }
  }

  const applied = results.every((r) => r.ok);
  return { applied, fileResults: results };
}
