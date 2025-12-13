import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { JsonlParser, stringifyJsonl } from './jsonl';

export type ServerEventHandler = (msg: any) => void;

export class ServerClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private readonly parser = new JsonlParser();

  constructor(private readonly onMessage: ServerEventHandler) {}

  start(params: { workspaceRoot: string; serverEntryPath: string }): void {
    if (this.proc) throw new Error('Server already started');

    this.proc = spawn('node', [params.serverEntryPath], {
      cwd: params.workspaceRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      env: process.env,
    });

    this.proc.stdout.on('data', (chunk) => {
      this.parser.feed(chunk, (obj) => this.onMessage(obj));
    });

    this.proc.stderr.on('data', (chunk) => {
      // stderr is for diagnostics; forward to UI as a non-protocol event.
      const text = chunk.toString();
      this.onMessage({ type: '__STDERR__', text });
    });

    this.proc.on('exit', (code) => {
      this.onMessage({ type: 'STATUS', sessionId: 'unknown', payload: { state: 'FAILED', detail: `Server exited (${code ?? 'unknown'})` } });
      this.proc = null;
    });
  }

  stop(): void {
    this.proc?.kill();
    this.proc = null;
  }

  send(msg: unknown): void {
    if (!this.proc) throw new Error('Server not started');
    this.proc.stdin.write(stringifyJsonl(msg));
  }
}
