import type { InboundMessage, MessageType, ProposedEdit } from './types.js';

const INBOUND_TYPES: ReadonlySet<string> = new Set([
  'INIT',
  'USER_PROMPT',
  'APPLY_EDIT_RESULT',
  'RUN_TOOL',
  'KEY_REQUEST',
  'CANCEL',
]);

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

export function validateInboundMessage(obj: unknown): { ok: true; value: InboundMessage } | { ok: false; error: string } {
  if (!isObject(obj)) return { ok: false, error: 'Message must be an object' };
  const type = obj.type;
  const sessionId = obj.sessionId;
  if (!isString(type)) return { ok: false, error: 'Message.type must be a string' };
  if (!INBOUND_TYPES.has(type)) return { ok: false, error: `Unknown inbound type: ${type}` };
  if (!isString(sessionId) || !sessionId) return { ok: false, error: 'Message.sessionId must be a non-empty string' };

  const payload = obj.payload;

  switch (type as MessageType) {
    case 'INIT':
      if (!isObject(payload)) return { ok: false, error: 'INIT.payload must be an object' };
      return { ok: true, value: { type: 'INIT', sessionId, payload } as InboundMessage };
    case 'USER_PROMPT':
      if (!isObject(payload) || !isString(payload.text) || !payload.text.trim()) {
        return { ok: false, error: 'USER_PROMPT.payload.text must be a non-empty string' };
      }
      return { ok: true, value: { type: 'USER_PROMPT', sessionId, payload } as InboundMessage };
    case 'APPLY_EDIT_RESULT':
      if (!isObject(payload)) return { ok: false, error: 'APPLY_EDIT_RESULT.payload must be an object' };
      if (typeof payload.applied !== 'boolean') return { ok: false, error: 'APPLY_EDIT_RESULT.payload.applied must be boolean' };
      if (!Array.isArray(payload.fileResults)) return { ok: false, error: 'APPLY_EDIT_RESULT.payload.fileResults must be an array' };
      return { ok: true, value: { type: 'APPLY_EDIT_RESULT', sessionId, payload } as InboundMessage };
    case 'RUN_TOOL':
      if (!isObject(payload) || !isString(payload.command) || !payload.command.trim()) {
        return { ok: false, error: 'RUN_TOOL.payload.command must be a non-empty string' };
      }
      return { ok: true, value: { type: 'RUN_TOOL', sessionId, payload } as InboundMessage };
    case 'KEY_REQUEST':
      if (!isObject(payload) || !isString(payload.provider) || !payload.provider.trim()) {
        return { ok: false, error: 'KEY_REQUEST.payload.provider must be a non-empty string' };
      }
      return { ok: true, value: { type: 'KEY_REQUEST', sessionId, payload } as InboundMessage };
    case 'CANCEL':
      if (payload !== undefined && !isObject(payload)) return { ok: false, error: 'CANCEL.payload must be an object if provided' };
      return { ok: true, value: { type: 'CANCEL', sessionId, payload } as InboundMessage };
    default:
      return { ok: false, error: `Unhandled inbound type: ${type}` };
  }
}

export function validateProposedEdits(edits: unknown): { ok: true; value: ProposedEdit[] } | { ok: false; error: string } {
  if (!Array.isArray(edits)) return { ok: false, error: 'edits must be an array' };
  for (const e of edits) {
    if (!isObject(e)) return { ok: false, error: 'each edit must be an object' };
    if (!isString(e.filePath) || !e.filePath) return { ok: false, error: 'edit.filePath must be a non-empty string' };
    if (!isString(e.newText)) return { ok: false, error: 'edit.newText must be a string' };
  }
  return { ok: true, value: edits as ProposedEdit[] };
}
