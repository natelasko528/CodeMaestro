export type JsonObject = Record<string, unknown>;

export type InboundMessageType =
  | 'INIT'
  | 'USER_PROMPT'
  | 'APPLY_EDIT_RESULT'
  | 'RUN_TOOL'
  | 'KEY_REQUEST'
  | 'CANCEL';

export type OutboundMessageType =
  | 'AGENT_MESSAGE'
  | 'PROPOSE_EDIT'
  | 'TOOL_OUTPUT'
  | 'REQUEST_USER_INPUT'
  | 'STATUS';

export type MessageType = InboundMessageType | OutboundMessageType;

export interface BaseMessage<T extends MessageType = MessageType> {
  type: T;
  sessionId: string;
  payload?: JsonObject;
}

export interface InitMessage extends BaseMessage<'INIT'> {
  payload: {
    workspaceRoot?: string;
    client?: { name: string; version?: string };
  };
}

export interface UserPromptMessage extends BaseMessage<'USER_PROMPT'> {
  payload: {
    text: string;
  };
}

export interface ApplyEditResultMessage extends BaseMessage<'APPLY_EDIT_RESULT'> {
  payload: {
    applied: boolean;
    fileResults: Array<{ filePath: string; ok: boolean; error: string | null }>;
  };
}

export interface RunToolMessage extends BaseMessage<'RUN_TOOL'> {
  payload: {
    command: string;
    cwd?: string;
  };
}

export interface KeyRequestMessage extends BaseMessage<'KEY_REQUEST'> {
  payload: {
    provider: string;
  };
}

export interface CancelMessage extends BaseMessage<'CANCEL'> {
  payload?: {
    reason?: string;
  };
}

export type InboundMessage =
  | InitMessage
  | UserPromptMessage
  | ApplyEditResultMessage
  | RunToolMessage
  | KeyRequestMessage
  | CancelMessage;

export interface AgentMessage extends BaseMessage<'AGENT_MESSAGE'> {
  payload: {
    agent: 'planner' | 'player' | 'coach' | string;
    phase: 'planner' | 'player' | 'coach' | string;
    text: string;
    partial?: boolean;
    level?: 'info' | 'warning' | 'error';
  };
}

export interface ProposedEdit {
  filePath: string; // workspace-relative
  newText: string; // full file content
  summary?: string;
}

export interface ProposeEditMessage extends BaseMessage<'PROPOSE_EDIT'> {
  payload: {
    edits: ProposedEdit[];
  };
}

export interface ToolOutputMessage extends BaseMessage<'TOOL_OUTPUT'> {
  payload: {
    command: string;
    cwd: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    truncated?: { stdout: boolean; stderr: boolean };
  };
}

export interface RequestUserInputMessage extends BaseMessage<'REQUEST_USER_INPUT'> {
  payload: {
    kind: string;
    provider?: string;
    prompt?: string;
  };
}

export interface StatusMessage extends BaseMessage<'STATUS'> {
  payload: {
    state: string;
    detail?: string;
  };
}

export type OutboundMessage =
  | AgentMessage
  | ProposeEditMessage
  | ToolOutputMessage
  | RequestUserInputMessage
  | StatusMessage;
