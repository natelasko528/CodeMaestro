import crypto from 'node:crypto';
import path from 'node:path';
import { ensureDir, readTextIfExists, writeText } from './fs.js';
import { redactObject } from './redact.js';
import type { JsonObject } from './types.js';
import { SESSIONS_DIR } from './constants.js';

export interface SessionMeta {
  sessionId: string;
  createdAt: string;
  workspaceRoot: string;
  workspaceHash: string;
  version: string;
}

export class SessionStore {
  readonly sessionRoot: string;
  private toolCounter = 0;
  private editCounter = 0;

  constructor(
    private readonly workspaceRoot: string,
    private readonly sessionId: string,
    private readonly version: string,
  ) {
    this.sessionRoot = path.join(workspaceRoot, SESSIONS_DIR, sessionId);
  }

  async init(): Promise<void> {
    await ensureDir(this.sessionRoot);
    await ensureDir(path.join(this.sessionRoot, 'tool'));
    await ensureDir(path.join(this.sessionRoot, 'edits'));

    const meta: SessionMeta = {
      sessionId: this.sessionId,
      createdAt: new Date().toISOString(),
      workspaceRoot: this.workspaceRoot,
      workspaceHash: await this.computeWorkspaceHash(),
      version: this.version,
    };
    await writeText(path.join(this.sessionRoot, 'meta.json'), JSON.stringify(meta, null, 2));

    const summaryPath = path.join(this.sessionRoot, 'summary.md');
    const exists = await readTextIfExists(summaryPath);
    if (exists === null) await writeText(summaryPath, '# Summary\n\n');
  }

  async appendEvent(event: JsonObject): Promise<void> {
    const redacted = redactObject(event);
    const line = `${JSON.stringify(redacted)}\n`;
    await ensureDir(this.sessionRoot);
    const eventsPath = path.join(this.sessionRoot, 'events.jsonl');
    // appendFile with utf8
    const fs = await import('node:fs/promises');
    await fs.appendFile(eventsPath, line, 'utf8');
  }

  async updateSummary(markdown: string): Promise<void> {
    const summaryPath = path.join(this.sessionRoot, 'summary.md');
    await writeText(summaryPath, markdown);
  }

  async recordToolExecution(params: {
    command: string;
    cwd: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    startedAt: string;
    endedAt: string;
  }): Promise<{ toolId: string }>{
    this.toolCounter += 1;
    const toolId = `T-${String(this.toolCounter).padStart(4, '0')}`;
    const dir = path.join(this.sessionRoot, 'tool');

    await writeText(path.join(dir, `${toolId}.json`), JSON.stringify({ toolId, ...redactObject(params) }, null, 2));
    await writeText(path.join(dir, `${toolId}.stdout.txt`), params.stdout);
    await writeText(path.join(dir, `${toolId}.stderr.txt`), params.stderr);

    return { toolId };
  }

  async recordProposedEdits(params: {
    edits: Array<{ filePath: string; beforeText: string | null; afterText: string }>;
  }): Promise<{ editId: string }>{
    this.editCounter += 1;
    const editId = `E-${String(this.editCounter).padStart(4, '0')}`;
    const root = path.join(this.sessionRoot, 'edits', editId);
    const beforeRoot = path.join(root, 'before');
    const afterRoot = path.join(root, 'after');

    await ensureDir(beforeRoot);
    await ensureDir(afterRoot);

    const manifestFiles: Array<{ filePath: string; beforeHash: string | null; afterHash: string }> = [];

    for (const e of params.edits) {
      const beforeHash = e.beforeText === null ? null : sha256(e.beforeText);
      const afterHash = sha256(e.afterText);
      manifestFiles.push({ filePath: e.filePath, beforeHash, afterHash });

      if (e.beforeText !== null) {
        await writeText(path.join(beforeRoot, e.filePath), e.beforeText);
      }
      await writeText(path.join(afterRoot, e.filePath), e.afterText);
    }

    await writeText(
      path.join(root, 'manifest.json'),
      JSON.stringify({ editId, files: manifestFiles }, null, 2),
    );

    return { editId };
  }

  private async computeWorkspaceHash(): Promise<string> {
    // MVP: stable hash from absolute root path (no file scanning).
    // Replay determinism requirement is about event sequences + hashes of edited files.
    return sha256(this.workspaceRoot);
  }
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}
