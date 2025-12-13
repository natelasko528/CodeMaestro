import process from 'node:process';
import path from 'node:path';
import { JsonlParser } from './jsonl.js';
import { validateInboundMessage, validateProposedEdits } from './validate.js';
import { StdioWriter } from './writer.js';
import { SessionStore } from './sessionStore.js';
import { SERVER_VERSION } from './version.js';
import { Orchestrator } from './orchestrator.js';
import { assertSafeRelativePath, resolveInside } from './paths.js';
import { readTextIfExists } from './fs.js';
import { runAllowlistedCommand } from './toolRunner.js';
import { replaySession } from './replay.js';
import type { InboundMessage, OutboundMessage, ProposedEdit } from './types.js';

type ActiveSession = {
  sessionId: string;
  workspaceRoot: string;
  store: SessionStore;
  orch: Orchestrator;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const replayIdx = args.indexOf('--replay');
  if (replayIdx !== -1) {
    const sessionId = args[replayIdx + 1];
    if (!sessionId) throw new Error('Missing sessionId after --replay');
    const workspaceRoot = process.cwd();
    await replaySession({ workspaceRoot, sessionId });
    return;
  }

  const writer = new StdioWriter();
  const parser = new JsonlParser();
  let active: ActiveSession | null = null;
  let inboundChain: Promise<void> = Promise.resolve();

  writer.write({ type: 'STATUS', sessionId: 'unknown', payload: { state: 'IDLE', detail: 'Server started' } });

  process.stdin.on('data', (chunk) => {
    parser.feed(chunk, (obj) => {
      inboundChain = inboundChain
        .then(() => handleInbound(obj))
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          const sid = active?.sessionId ?? 'unknown';
          writer.write({
            type: 'AGENT_MESSAGE',
            sessionId: sid,
            payload: { agent: 'server', phase: 'server', text: `ERROR: ${message}`, level: 'error' },
          });
        });
    });
  });

  async function handleInbound(obj: unknown): Promise<void> {
    const validated = validateInboundMessage(obj);
    if (!validated.ok) {
      writer.write({
        type: 'AGENT_MESSAGE',
        sessionId: active?.sessionId ?? 'unknown',
        payload: { agent: 'server', phase: 'server', text: `Invalid message: ${validated.error}`, level: 'error' },
      });
      return;
    }

    const msg = validated.value;

    if (!active) {
      // Bind the server process to the first sessionId and workspaceRoot.
      const workspaceRoot = inferWorkspaceRoot(msg);
      const store = new SessionStore(workspaceRoot, msg.sessionId, SERVER_VERSION);
      await store.init();
      const orch = new Orchestrator({ workspaceRoot, sessionId: msg.sessionId });
      active = { sessionId: msg.sessionId, workspaceRoot, store, orch };

      await send({ type: 'STATUS', sessionId: active.sessionId, payload: { state: 'IDLE', detail: 'Session initialized' } });
    }

    if (msg.sessionId !== active.sessionId) {
      await send({
        type: 'AGENT_MESSAGE',
        sessionId: active.sessionId,
        payload: { agent: 'server', phase: 'server', text: 'Ignoring message for different sessionId', level: 'warning' },
      });
      return;
    }

    await logEvent('in', msg);

    switch (msg.type) {
      case 'INIT': {
        await send({ type: 'STATUS', sessionId: active.sessionId, payload: { state: active.orch.getState() } });
        return;
      }
      case 'USER_PROMPT': {
        const outs = await active.orch.onUserPrompt(msg.payload.text);
        await emitOrchestratorOutputs(outs);
        return;
      }
      case 'APPLY_EDIT_RESULT': {
        const outs = await active.orch.onApplyResult(msg.payload.applied);
        await emitOrchestratorOutputs(outs);
        if (outs.some((o) => o.requestTool)) {
          // RUN tool immediately in MVP
          const req = outs.find((o) => o.requestTool)?.requestTool;
          if (req) await runToolAndReturn(req.command, req.cwd);
        }
        return;
      }
      case 'RUN_TOOL': {
        const cwd = msg.payload.cwd ? path.resolve(active.workspaceRoot, msg.payload.cwd) : path.join(active.workspaceRoot, 'server');
        await runToolAndReturn(msg.payload.command, cwd);
        return;
      }
      case 'KEY_REQUEST': {
        await send({
          type: 'REQUEST_USER_INPUT',
          sessionId: active.sessionId,
          payload: { kind: 'KEY_REQUEST', provider: msg.payload.provider },
        } as OutboundMessage);
        return;
      }
      case 'CANCEL': {
        await send({ type: 'STATUS', sessionId: active.sessionId, payload: { state: 'FAILED', detail: 'Cancelled' } });
        return;
      }
      default:
        return;
    }
  }

  async function emitOrchestratorOutputs(outs: Array<ReturnType<Orchestrator['onToolOutput']>[number] | Awaited<ReturnType<Orchestrator['onUserPrompt']>>[number]>): Promise<void> {
    for (const o of outs as any[]) {
      if (o.plannerText) {
        await send({
          type: 'AGENT_MESSAGE',
          sessionId: active!.sessionId,
          payload: { agent: 'planner', phase: 'planner', text: o.plannerText },
        });
      }
      if (o.playerText) {
        await send({
          type: 'AGENT_MESSAGE',
          sessionId: active!.sessionId,
          payload: { agent: 'player', phase: 'player', text: o.playerText },
        });
      }
      if (o.coachText) {
        await send({
          type: 'AGENT_MESSAGE',
          sessionId: active!.sessionId,
          payload: { agent: 'coach', phase: 'coach', text: o.coachText },
        });
      }
      if (o.proposeEdits) {
        await recordEditsSnapshot(o.proposeEdits);
        await send({ type: 'PROPOSE_EDIT', sessionId: active!.sessionId, payload: { edits: o.proposeEdits } });
      }
      if (o.state) {
        await send({ type: 'STATUS', sessionId: active!.sessionId, payload: { state: o.state } });
        await updateSummary();
      }
    }
  }

  async function runToolAndReturn(command: string, cwd: string): Promise<void> {
    const startedAt = new Date().toISOString();
    const res = await runAllowlistedCommand({ command, cwd, workspaceRoot: active!.workspaceRoot });
    const endedAt = new Date().toISOString();

    await active!.store.recordToolExecution({
      command,
      cwd,
      exitCode: res.exitCode,
      stdout: res.stdout,
      stderr: res.stderr,
      startedAt,
      endedAt,
    });

    await send({
      type: 'TOOL_OUTPUT',
      sessionId: active!.sessionId,
      payload: {
        command,
        cwd,
        exitCode: res.exitCode,
        stdout: res.ui.stdout,
        stderr: res.ui.stderr,
        truncated: res.ui.truncated,
      },
    });

    const outs = active!.orch.onToolOutput(res.exitCode);
    await emitOrchestratorOutputs(outs);
  }

  async function recordEditsSnapshot(edits: ProposedEdit[]): Promise<void> {
    const validated = validateProposedEdits(edits);
    if (!validated.ok) throw new Error(validated.error);

    const snapshot: Array<{ filePath: string; beforeText: string | null; afterText: string }> = [];
    for (const e of edits) {
      assertSafeRelativePath(e.filePath);
      if (Buffer.byteLength(e.newText, 'utf8') > 2 * 1024 * 1024) throw new Error('newText exceeds 2MB');
      const abs = resolveInside(active!.workspaceRoot, e.filePath);
      const before = await readTextIfExists(abs);
      snapshot.push({ filePath: e.filePath, beforeText: before, afterText: e.newText });
    }
    await active!.store.recordProposedEdits({ edits: snapshot });
  }

  async function updateSummary(): Promise<void> {
    const summary = [
      '# Summary',
      '',
      `- sessionId: ${active!.sessionId}`,
      `- state: ${active!.orch.getState()}`,
      `- lastUpdated: ${new Date().toISOString()}`,
      '',
      'Next actions:',
      '- Await edits apply result or tool output depending on state.',
      '',
    ].join('\n');
    await active!.store.updateSummary(summary);
  }

  async function send(msg: OutboundMessage): Promise<void> {
    writer.write(msg);
    await logEvent('out', msg);
  }

  async function logEvent(direction: 'in' | 'out', msg: InboundMessage | OutboundMessage): Promise<void> {
    await active!.store.appendEvent({ direction, ...msg } as any);
  }

  function inferWorkspaceRoot(msg: InboundMessage): string {
    if (msg.type === 'INIT' && msg.payload.workspaceRoot && typeof msg.payload.workspaceRoot === 'string') {
      return path.resolve(msg.payload.workspaceRoot);
    }
    return process.cwd();
  }
}

main().catch((e) => {
  const message = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
