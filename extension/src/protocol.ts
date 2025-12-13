export type JsonObject = Record<string, unknown>;

export type InboundFromServerType =
  | 'AGENT_MESSAGE'
  | 'PROPOSE_EDIT'
  | 'TOOL_OUTPUT'
  | 'REQUEST_USER_INPUT'
  | 'STATUS';

export type OutboundToServerType = 'INIT' | 'USER_PROMPT' | 'APPLY_EDIT_RESULT' | 'RUN_TOOL' | 'KEY_REQUEST' | 'CANCEL';

export type MessageType = InboundFromServerType | OutboundToServerType;

export interface BaseMessage<T extends MessageType = MessageType> {
  type: T;
  sessionId: string;
  payload?: JsonObject;
}

export interface ProposedEdit {
  filePath: string;
  newText: string;
  summary?: string;
}

export interface ProposeEditMessage extends BaseMessage<'PROPOSE_EDIT'> {
  payload: {
    edits: ProposedEdit[];
  };
}

export interface ApplyEditResultMessage extends BaseMessage<'APPLY_EDIT_RESULT'> {
  payload: {
    applied: boolean;
    fileResults: Array<{ filePath: string; ok: boolean; error: string | null }>;
  };
}
