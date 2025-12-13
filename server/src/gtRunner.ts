import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { JsonlParser, stringifyJsonl } from './jsonl.js';
import type { ProposeEditMessage, ToolOutputMessage } from './types.js';

type AnyMsg = Record<string, any>;

async function main(): Promise<void> {
  const workspaceRoot = process.cwd();
  // When run from /workspace/server, the workspace root is one level up.
  const inferredWorkspaceRoot = path.resolve(workspaceRoot, '..');
  const serverEntry = path.join(inferredWorkspaceRoot, 'server', 'dist', 'index.js');
  const gt004Path = path.join(inferredWorkspaceRoot, 'server', 'src', '__tests__', 'gt004-demo.test.ts');
  const gt004PassingText = `describe('GT-004 demo', () => {\n  test('baseline: passing test (gtRunner will temporarily flip it to failing)', () => {\n    expect(1).toBe(1);\n  });\n});\n`;

  try {
    await fs.access(serverEntry);
  } catch {
    throw new Error(`Server not built. Expected: ${serverEntry}. Run: cd server && npm run build`);
  }

  const sessionId = `S-GT-${Date.now()}`;
  const proc = spawn('node', [serverEntry], {
    cwd: inferredWorkspaceRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    env: process.env,
  });

  const parser = new JsonlParser();
  const out: AnyMsg[] = [];

  proc.stdout.on('data', (chunk) => {
    parser.feed(chunk, (obj) => {
      if (obj && typeof obj === 'object') out.push(obj as AnyMsg);
    });
  });

  let stderr = '';
  proc.stderr.on('data', (d) => {
    stderr += d.toString();
  });

  try {
    send(proc, {
      type: 'INIT',
      sessionId,
      payload: {
        workspaceRoot: inferredWorkspaceRoot,
        client: { name: 'gt-runner' },
        // GT-005 proof (redaction): ensure any field named token/key/secret is redacted in events.jsonl
        token: 'GT-SECRET-TOKEN',
      },
    });

    await waitFor(out, (m) => m.type === 'STATUS' && m.sessionId === sessionId);

    // GT-001
    send(proc, {
      type: 'USER_PROMPT',
      sessionId,
      payload: { text: 'Implement MVP wiring for protocol + diff proposal flow. (GT-004)' },
    });

    const planner = await waitFor(out, (m) => m.type === 'AGENT_MESSAGE' && m.payload?.phase === 'planner' && m.sessionId === sessionId);
    const plannerText = String(planner.payload?.text ?? '');
    const gt1Ok = /\n?1\./.test(plannerText);

    // GT-002 (server proposes 2+ files)
    const propose = (await waitFor(out, (m) => m.type === 'PROPOSE_EDIT' && m.sessionId === sessionId)) as unknown as ProposeEditMessage;
    const edits = propose.payload.edits;
    const gt2Ok = Array.isArray(edits) && edits.length >= 2;

    // Apply edits ourselves (simulating extension apply)
    const fileResults: Array<{ filePath: string; ok: boolean; error: string | null }> = [];
    for (const e of edits) {
      try {
        const abs = path.join(inferredWorkspaceRoot, e.filePath);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, e.newText, 'utf8');
        fileResults.push({ filePath: e.filePath, ok: true, error: null });
      } catch (err: unknown) {
        fileResults.push({ filePath: e.filePath, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    send(proc, {
      type: 'APPLY_EDIT_RESULT',
      sessionId,
      payload: { applied: fileResults.every((r) => r.ok), fileResults },
    });

    // GT-003: expect tool output for allowlisted npm test
    const tool1 = (await waitFor(out, (m) => m.type === 'TOOL_OUTPUT' && m.sessionId === sessionId)) as unknown as AnyMsg;
    const tool1Typed = tool1 as unknown as ToolOutputMessage;
    const gt3Ok = tool1Typed.payload.command === 'npm test' && typeof tool1Typed.payload.exitCode === 'number';

    // GT-004: demonstrate coach gating + fix iteration.
    const gt4SawFail = typeof tool1Typed.payload.exitCode === 'number' && tool1Typed.payload.exitCode !== 0;

    const coachFail = await waitFor(
      out,
      (m) =>
        m.type === 'AGENT_MESSAGE' &&
        m.sessionId === sessionId &&
        m.payload?.agent === 'coach' &&
        typeof m.payload?.text === 'string' &&
        m.payload.text.includes('Required fix'),
    );
    const gt4CoachOk = typeof coachFail.payload?.text === 'string' && coachFail.payload.text.includes('gt004-demo.test.ts');

    const proposeFix = (await waitFor(out, (m) => {
      if (m.type !== 'PROPOSE_EDIT' || m.sessionId !== sessionId) return false;
      const edits = m.payload?.edits;
      return (
        Array.isArray(edits) &&
        edits.some(
          (e: any) =>
            String(e.filePath ?? '').includes('gt004-demo.test.ts') &&
            typeof e.newText === 'string' &&
            e.newText.includes('expect(1).toBe(1)'),
        )
      );
    })) as unknown as ProposeEditMessage;

    const fixEdits = proposeFix.payload.edits.filter((e) => e.filePath.includes('gt004-demo.test.ts'));
    const fixResults: Array<{ filePath: string; ok: boolean; error: string | null }> = [];
    for (const e of fixEdits) {
      try {
        const abs = path.join(inferredWorkspaceRoot, e.filePath);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, e.newText, 'utf8');
        fixResults.push({ filePath: e.filePath, ok: true, error: null });
      } catch (err: unknown) {
        fixResults.push({ filePath: e.filePath, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    send(proc, {
      type: 'APPLY_EDIT_RESULT',
      sessionId,
      payload: { applied: fixResults.every((r) => r.ok), fileResults: fixResults },
    });

    const tool1Idx = out.indexOf(tool1 as AnyMsg);
    const tool2 = (await waitFor(out, (_m) => {
      const idx = out.indexOf(_m as AnyMsg);
      return idx > tool1Idx && (_m as AnyMsg).type === 'TOOL_OUTPUT' && (_m as AnyMsg).sessionId === sessionId;
    })) as unknown as ToolOutputMessage;
    const gt4PassAfterFix = tool2.payload.exitCode === 0;
    const gt4Ok = gt4SawFail && gt4CoachOk && gt4PassAfterFix;

    // Done (after fix)
    await waitFor(out, (m) => m.type === 'STATUS' && m.sessionId === sessionId && m.payload?.state === 'DONE');

    // GT-006: replay should produce replay_report.md and same outbound type sequence
    const replayReportPath = path.join(inferredWorkspaceRoot, '.codemaestro', 'sessions', sessionId, 'replay_report.md');
    const replayProc = spawn('node', [serverEntry, '--replay', sessionId], {
      cwd: inferredWorkspaceRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    const replayParser = new JsonlParser();
    const replayOut: AnyMsg[] = [];
    replayProc.stdout.on('data', (chunk) =>
      replayParser.feed(chunk, (obj) => obj && typeof obj === 'object' && replayOut.push(obj as AnyMsg)),
    );

    await new Promise<void>((resolve, reject) => {
      replayProc.on('error', reject);
      replayProc.on('close', () => resolve());
    });

    await fs.access(replayReportPath);

    const sessionRoot = path.join(inferredWorkspaceRoot, '.codemaestro', 'sessions', sessionId);
    const eventsJsonl = await fs.readFile(path.join(sessionRoot, 'events.jsonl'), 'utf8');
    const gt5Ok = !eventsJsonl.includes('GT-SECRET-TOKEN') && eventsJsonl.includes('[REDACTED]');

    const recordedOutTypes = extractOutTypes(eventsJsonl);
    const replayOutTypes = replayOut.map((m) => String(m.type ?? ''));
    const gt6Ok = recordedOutTypes.join(',') === replayOutTypes.join(',');

    // Write MVP_REPORT.md
    const report = `# MVP Report\n\n## Evidence\n\n- SessionId: **${sessionId}**\n- Session artifacts: \\\`.codemaestro/sessions/${sessionId}/\\\`\n- Server build: \\\`cd server && npm run build\\\`\n- Server tests: \\\`cd server && npm test\\\`\n- Extension build/tests: \\\`cd extension && npm run build && npm test\\\`\n\n## Golden Tasks (automated runner)\n\n- GT-001 (planner output + session boot): ${gt1Ok ? 'PASS' : 'FAIL'}\n- GT-002 (2+ file propose + apply simulated): ${gt2Ok ? 'PASS' : 'FAIL'}\n- GT-003 (allowlisted tool + output capture): ${gt3Ok ? 'PASS' : 'FAIL'}\n- GT-004 (coach gating + fix + rerun): ${gt4Ok ? 'PASS' : 'FAIL'}\n- GT-005 (redaction at write time): ${gt5Ok ? 'PASS' : 'FAIL'}\n- GT-006 (replay report + outbound sequence match): ${gt6Ok ? 'PASS' : 'FAIL'}\n\n## Notes\n\n- GT-002 “diff preview” is exercised in VS Code via the extension UI (Preview button uses \\\`vscode.diff\\\`).\n\n## Stderr (if any)\n\n\\\`\\\`\\\`\n${stderr.trim()}\n\\\`\\\`\\\`\n`;

    await fs.writeFile(path.join(inferredWorkspaceRoot, 'MVP_REPORT.md'), report, 'utf8');
  } finally {
    // Always restore a passing version of the GT-004 demo test, even if the run fails.
    await fs.mkdir(path.dirname(gt004Path), { recursive: true });
    await fs.writeFile(gt004Path, gt004PassingText, 'utf8');
    proc.kill();
  }
}

function send(proc: ChildProcessWithoutNullStreams, msg: unknown): void {
  proc.stdin.write(stringifyJsonl(msg));
}

async function waitFor<T extends AnyMsg>(buf: AnyMsg[], pred: (m: AnyMsg) => boolean, timeoutMs = 60_000): Promise<T> {
  const started = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const found = buf.find(pred);
    if (found) return found as T;
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for message');
    await new Promise((r) => setTimeout(r, 10));
  }
}

function extractOutTypes(eventsJsonl: string): string[] {
  const lines = eventsJsonl.split('\n').filter(Boolean);
  const outTypes: string[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as AnyMsg;
      if (obj.direction === 'out' && typeof obj.type === 'string') outTypes.push(obj.type);
    } catch {
      // ignore
    }
  }
  return outTypes;
}

main().catch((e) => {
  const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
  process.stderr.write(`${msg}\n`);
  process.exit(1);
});
