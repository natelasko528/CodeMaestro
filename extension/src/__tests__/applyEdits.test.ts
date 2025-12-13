import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { applyProposedEdits } from '../applyEdits';

describe('applyProposedEdits', () => {
  test('writes files under workspace root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codemaestro-ext-'));

    const res = await applyProposedEdits({
      workspaceRoot: root,
      edits: [
        { filePath: 'a.txt', newText: 'hello' },
        { filePath: 'nested/b.txt', newText: 'world' },
      ],
    });

    expect(res.applied).toBe(true);
    expect(await fs.readFile(path.join(root, 'a.txt'), 'utf8')).toBe('hello');
    expect(await fs.readFile(path.join(root, 'nested', 'b.txt'), 'utf8')).toBe('world');
  });

  test('blocks path traversal', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codemaestro-ext-'));

    const res = await applyProposedEdits({
      workspaceRoot: root,
      edits: [{ filePath: '../escape.txt', newText: 'nope' }],
    });

    expect(res.applied).toBe(false);
    expect(res.fileResults[0]?.ok).toBe(false);
  });
});
