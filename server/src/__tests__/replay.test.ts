import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { stringifyJsonl } from '../jsonl.js';
import { replaySession } from '../replay.js';

describe('replaySession', () => {
  test('writes replay_report.md', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codemaestro-'));
    const sessionRoot = path.join(root, '.codemaestro', 'sessions', 'S-9');
    await fs.mkdir(sessionRoot, { recursive: true });

    const events = [
      { direction: 'in', type: 'INIT', sessionId: 'S-9', payload: {} },
      { direction: 'out', type: 'STATUS', sessionId: 'S-9', payload: { state: 'IDLE' } },
    ];
    await fs.writeFile(path.join(sessionRoot, 'events.jsonl'), events.map(stringifyJsonl).join(''), 'utf8');

    // Capture stdout during replay
    const writes: string[] = [];
    const orig = process.stdout.write;
    process.stdout.write = ((s: unknown) => {
      writes.push(String(s));
      return true;
    }) as typeof process.stdout.write;

    try {
      await replaySession({ workspaceRoot: root, sessionId: 'S-9' });
    } finally {
      process.stdout.write = orig;
    }

    const report = await fs.readFile(path.join(sessionRoot, 'replay_report.md'), 'utf8');
    expect(report).toContain('Replay Report');
    expect(writes.join('')).toContain('STATUS');
  });
});
