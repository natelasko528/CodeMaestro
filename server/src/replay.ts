import fs from 'node:fs/promises';
import path from 'node:path';
import { JsonlParser, stringifyJsonl } from './jsonl.js';
import type { JsonObject } from './types.js';
import { SESSIONS_DIR } from './constants.js';

export async function replaySession(params: {
  workspaceRoot: string;
  sessionId: string;
}): Promise<void> {
  const sessionRoot = path.join(params.workspaceRoot, SESSIONS_DIR, params.sessionId);
  const eventsPath = path.join(sessionRoot, 'events.jsonl');

  const raw = await fs.readFile(eventsPath, 'utf8');
  const parser = new JsonlParser();

  const events: JsonObject[] = [];
  parser.feed(raw, (obj) => {
    if (obj && typeof obj === 'object') events.push(obj as JsonObject);
  });

  // Emit only outbound events back to the UI.
  const outbound = events.filter((e) => e.direction === 'out' && typeof e.type === 'string');
  for (const e of outbound) {
    // Strip direction metadata on replay; UI expects protocol messages.
    const msg = { ...(e as Record<string, unknown>) };
    delete msg.direction;
    process.stdout.write(stringifyJsonl(msg));
  }

  const sequence = events
    .filter((e) => typeof e.type === 'string')
    .map((e) => `${String(e.direction ?? 'unknown')}:${String(e.type)}`)
    .join('\n');

  const report = `# Replay Report\n\nSession: ${params.sessionId}\n\n## Event type sequence\n\n\n${sequence}\n`;
  await fs.writeFile(path.join(sessionRoot, 'replay_report.md'), report, 'utf8');
}
