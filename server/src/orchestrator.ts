import path from 'node:path';
import crypto from 'node:crypto';
import type { ProposedEdit } from './types.js';
import { resolveInside } from './paths.js';
import { readTextIfExists } from './fs.js';

export type OrchestratorState =
  | 'IDLE'
  | 'PLANNING'
  | 'BUILDING'
  | 'VERIFYING'
  | 'WAITING_FOR_APPLY'
  | 'RUNNING_TOOL'
  | 'DONE'
  | 'FAILED';

export interface OrchestratorOutputs {
  state: OrchestratorState;
  plannerText?: string;
  playerText?: string;
  coachText?: string;
  proposeEdits?: ProposedEdit[];
  requestTool?: { command: string; cwd: string };
  done?: boolean;
  failReason?: string;
}

export interface OrchestratorConfig {
  workspaceRoot: string;
  sessionId: string;
}

/**
 * MVP deterministic orchestrator that proves the loop + artifacts.
 *
 * For now it does NOT use a real LLM provider; it emits predictable edits under
 * `.codemaestro/scratch/<sessionId>/` so Golden Tasks can validate multi-file apply.
 */
export class Orchestrator {
  private state: OrchestratorState = 'IDLE';

  constructor(private readonly cfg: OrchestratorConfig) {}

  getState(): OrchestratorState {
    return this.state;
  }

  async onUserPrompt(text: string): Promise<OrchestratorOutputs[]> {
    const outs: OrchestratorOutputs[] = [];

    this.state = 'PLANNING';
    outs.push({
      state: this.state,
      plannerText: this.makePlannerPlan(text),
    });

    this.state = 'BUILDING';
    const edits = await this.makeDeterministicEdits(text);
    outs.push({
      state: this.state,
      playerText: 'I will propose a small, deterministic multi-file edit so you can preview and apply it.',
      proposeEdits: edits,
    });

    this.state = 'WAITING_FOR_APPLY';
    outs.push({ state: this.state });

    return outs;
  }

  async onApplyResult(applied: boolean): Promise<OrchestratorOutputs[]> {
    const outs: OrchestratorOutputs[] = [];

    if (!applied) {
      this.state = 'FAILED';
      outs.push({ state: this.state, failReason: 'User rejected proposed edits.' });
      return outs;
    }

    this.state = 'VERIFYING';
    outs.push({
      state: this.state,
      coachText: 'Running allowlisted checks (npm test) before declaring DONE.',
      requestTool: { command: 'npm test', cwd: path.join(this.cfg.workspaceRoot, 'server') },
    });

    this.state = 'RUNNING_TOOL';
    outs.push({ state: this.state });
    return outs;
  }

  onToolOutput(exitCode: number): OrchestratorOutputs[] {
    const outs: OrchestratorOutputs[] = [];
    this.state = 'VERIFYING';

    if (exitCode === 0) {
      this.state = 'DONE';
      outs.push({
        state: this.state,
        coachText: 'PASS: checks are green. MVP loop satisfied for this session.',
        done: true,
      });
    } else {
      this.state = 'FAILED';
      outs.push({
        state: this.state,
        coachText: 'FAIL: checks failed. Please fix and re-run.',
        failReason: 'Tool command failed',
      });
    }

    return outs;
  }

  private makePlannerPlan(userText: string): string {
    // Numbered plan required by GT-001.
    return [
      '1. Validate protocol + session boot',
      '2. Propose a deterministic multi-file edit for diff/apply',
      '3. Apply edits and record artifacts',
      '4. Run allowlisted tools (npm test) and capture output',
      '5. If green, mark DONE; otherwise iterate fixes',
      '',
      `User request: ${userText}`,
    ].join('\n');
  }

  private async makeDeterministicEdits(userText: string): Promise<ProposedEdit[]> {
    const scratch = `.codemaestro/scratch/${this.cfg.sessionId}`;
    const fileA = `${scratch}/note-a.txt`;
    const fileB = `${scratch}/note-b.txt`;

    // Stable nonce per session/prompt (no randomness) to keep replay predictable.
    const stable = sha256(`${this.cfg.sessionId}\n${userText}`);

    const textA = `CodeMaestro MVP\nSession: ${this.cfg.sessionId}\nStable: ${stable}\n\nPrompt:\n${userText}\n`;
    const textB = `This is the second file for multi-file apply.\nSession: ${this.cfg.sessionId}\n`;

    // If files already exist, keep them idempotent by overwriting.
    void (await readTextIfExists(resolveInside(this.cfg.workspaceRoot, fileA)));
    void (await readTextIfExists(resolveInside(this.cfg.workspaceRoot, fileB)));

    return [
      { filePath: fileA, newText: textA, summary: 'Write scratch note A (deterministic multi-file apply)' },
      { filePath: fileB, newText: textB, summary: 'Write scratch note B (deterministic multi-file apply)' },
    ];
  }
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}
