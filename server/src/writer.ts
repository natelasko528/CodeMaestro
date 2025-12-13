import { stringifyJsonl } from './jsonl.js';
import type { AgentMessage, OutboundMessage } from './types.js';

export class StdioWriter {
  write(msg: OutboundMessage): void {
    process.stdout.write(stringifyJsonl(msg));
  }

  status(sessionId: string, state: string, detail?: string): void {
    this.write({ type: 'STATUS', sessionId, payload: { state, detail } });
  }

  agentMessage(sessionId: string, payload: AgentMessage['payload']): void {
    this.write({ type: 'AGENT_MESSAGE', sessionId, payload });
  }
}
