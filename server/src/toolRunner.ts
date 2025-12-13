import { spawn } from 'node:child_process';
import path from 'node:path';

const ALLOWLIST: ReadonlySet<string> = new Set([
  'npm test',
  'npm run test',
  'npm run lint',
  'npm run build',
  'pnpm test',
  'pnpm run lint',
  'pnpm run build',
  'yarn test',
  'yarn lint',
  'yarn build',
  'pytest',
  'python -m pytest',
  'ruff check .',
  'mypy .',
]);

export function assertAllowlisted(command: string): void {
  const trimmed = command.trim();
  if (!ALLOWLIST.has(trimmed)) throw new Error(`Command not allowlisted: ${trimmed}`);

  // Enforce no chaining / redirection beyond exact match.
  if (/[|;&><]/.test(trimmed)) throw new Error('Invalid command characters');
}

export async function runAllowlistedCommand(params: {
  command: string;
  cwd: string;
  workspaceRoot: string;
  maxUiBytes?: number;
}): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  ui: { stdout: string; stderr: string; truncated: { stdout: boolean; stderr: boolean } };
}> {
  const command = params.command.trim();
  assertAllowlisted(command);

  const cwd = path.resolve(params.cwd);
  const root = path.resolve(params.workspaceRoot);
  if (!cwd.startsWith(root)) throw new Error('cwd must be inside workspace root');

  const [bin, ...args] = splitCommand(command);

  const startedAt = Date.now();
  const child = spawn(bin, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: process.env,
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  child.stdout.on('data', (d) => stdoutChunks.push(Buffer.from(d)));
  child.stderr.on('data', (d) => stderrChunks.push(Buffer.from(d)));

  const exitCode: number = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });

  const stdout = Buffer.concat(stdoutChunks).toString('utf8');
  const stderr = Buffer.concat(stderrChunks).toString('utf8');

  const maxUiBytes = params.maxUiBytes ?? 200 * 1024;
  const uiStdout = truncateUtf8(stdout, maxUiBytes);
  const uiStderr = truncateUtf8(stderr, maxUiBytes);

  void startedAt; // reserved for metadata in session store

  return {
    exitCode,
    stdout,
    stderr,
    ui: {
      stdout: uiStdout.text,
      stderr: uiStderr.text,
      truncated: { stdout: uiStdout.truncated, stderr: uiStderr.truncated },
    },
  };
}

function splitCommand(command: string): string[] {
  // MVP: allowlist is exact strings with simple tokens.
  return command.split(' ').filter(Boolean);
}

function truncateUtf8(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const buf = Buffer.from(text, 'utf8');
  if (buf.byteLength <= maxBytes) return { text, truncated: false };
  const sliced = buf.subarray(0, maxBytes);
  return { text: sliced.toString('utf8'), truncated: true };
}
