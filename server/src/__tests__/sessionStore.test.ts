import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SessionStore } from '../sessionStore.js';

describe('SessionStore', () => {
  test('creates expected layout and appends events', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codemaestro-'));
    const store = new SessionStore(root, 'S-123', 'test');
    await store.init();

    await store.appendEvent({ direction: 'out', type: 'STATUS', sessionId: 'S-123', payload: { state: 'IDLE' } });

    const sessionRoot = path.join(root, '.codemaestro', 'sessions', 'S-123');
    const meta = await fs.readFile(path.join(sessionRoot, 'meta.json'), 'utf8');
    expect(meta).toContain('S-123');

    const events = await fs.readFile(path.join(sessionRoot, 'events.jsonl'), 'utf8');
    expect(events).toContain('STATUS');

    const summary = await fs.readFile(path.join(sessionRoot, 'summary.md'), 'utf8');
    expect(summary).toContain('# Summary');
  });
});
