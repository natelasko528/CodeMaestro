import * as vscode from 'vscode';
import path from 'node:path';
import fs from 'node:fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { InMemoryContentProvider, makeAfterUri, makeBeforeUri } from './contentProvider';
import { ServerClient } from './serverClient';
import { getWebviewHtml } from './webview';
import { applyProposedEdits } from './applyEdits';
import type { ProposedEdit } from './protocol';

type ChatState = {
  sessionId: string | null;
  lastEdits: ProposedEdit[];
};

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('CodeMaestro');
  const beforeProvider = new InMemoryContentProvider();
  const afterProvider = new InMemoryContentProvider();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('codemaestro-before', beforeProvider),
    vscode.workspace.registerTextDocumentContentProvider('codemaestro-after', afterProvider),
    output,
  );

  const state: ChatState = { sessionId: null, lastEdits: [] };

  let panel: vscode.WebviewPanel | null = null;
  const client = new ServerClient((msg) => {
    if (!msg || typeof msg !== 'object') return;
    const type = (msg as any).type;
    if (!type) return;

    if (type === '__STDERR__') {
      const line = `[server stderr] ${(msg as any).text ?? ''}`.trim();
      output.appendLine(line);
      panel?.webview.postMessage({ type: 'LOG', text: line });
      return;
    }

    if (type === 'AGENT_MESSAGE') {
      const p = (msg as any).payload;
      const line = `[${p?.agent ?? 'agent'}:${p?.phase ?? 'phase'}] ${p?.text ?? ''}`;
      output.appendLine(line);
      panel?.webview.postMessage({ type: 'LOG', text: line });
    }

    if (type === 'STATUS') {
      const p = (msg as any).payload;
      const line = `[STATUS] ${p?.state ?? ''} ${p?.detail ?? ''}`.trim();
      output.appendLine(line);
      panel?.webview.postMessage({ type: 'LOG', text: line });
    }

    if (type === 'PROPOSE_EDIT') {
      const edits = (msg as any).payload?.edits as ProposedEdit[] | undefined;
      if (!Array.isArray(edits)) return;
      state.lastEdits = edits;
      if (state.sessionId) {
        void seedDiffProviders(state.sessionId, edits);
      }
      panel?.webview.postMessage({ type: 'PROPOSE_EDIT', edits: edits.map((e) => ({ filePath: e.filePath })) });
      void vscode.window.showInformationMessage(`CodeMaestro proposed edits to ${edits.length} file(s).`, 'Open Chat');
    }

    if (type === 'TOOL_OUTPUT') {
      const p = (msg as any).payload;
      const line = `[TOOL] ${p?.command ?? ''} (exit ${p?.exitCode ?? '?'})`;
      output.appendLine(line);
      panel?.webview.postMessage({ type: 'LOG', text: line });
      if (p?.stdout) panel?.webview.postMessage({ type: 'LOG', text: String(p.stdout) });
      if (p?.stderr) panel?.webview.postMessage({ type: 'LOG', text: String(p.stderr) });
    }
  });

  async function openChat(): Promise<void> {
    if (panel) {
      panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    panel = vscode.window.createWebviewPanel('codemaestro.chat', 'CodeMaestro', vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    panel.webview.html = getWebviewHtml(panel.webview);

    panel.onDidDispose(() => {
      panel = null;
    });

    panel.webview.onDidReceiveMessage(async (m) => {
      if (!m || typeof m !== 'object') return;
      if (m.type === 'USER_PROMPT') {
        if (!state.sessionId) {
          void vscode.window.showErrorMessage('Start a session first (CodeMaestro: Start Session).');
          return;
        }
        client.send({ type: 'USER_PROMPT', sessionId: state.sessionId, payload: { text: String(m.text ?? '') } });
      }
      if (m.type === 'PREVIEW_EDIT') {
        if (!state.sessionId) return;
        const fp = String(m.filePath ?? '');
        await previewDiff(state.sessionId, fp);
      }
      if (m.type === 'APPLY_ALL') {
        if (!state.sessionId) return;
        await applyAllEdits();
      }
      if (m.type === 'REJECT_ALL') {
        if (!state.sessionId) return;
        client.send({ type: 'APPLY_EDIT_RESULT', sessionId: state.sessionId, payload: { applied: false, fileResults: [] } });
      }
    });
  }

  async function startSession(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      void vscode.window.showErrorMessage('Open a workspace folder first.');
      return;
    }

    state.sessionId = `S-${uuidv4()}`;
    state.lastEdits = [];

    const serverEntryPath = path.join(folder.uri.fsPath, 'server', 'dist', 'index.js');
    try {
      await fs.access(serverEntryPath);
    } catch {
      void vscode.window.showErrorMessage('Server is not built yet. Run: cd server && npm run build');
      return;
    }

    client.start({ workspaceRoot: folder.uri.fsPath, serverEntryPath });
    client.send({ type: 'INIT', sessionId: state.sessionId, payload: { workspaceRoot: folder.uri.fsPath, client: { name: 'vscode-extension' } } });

    await openChat();
    panel?.webview.postMessage({ type: 'LOG', text: `Session started: ${state.sessionId}` });
  }

  async function seedDiffProviders(sessionId: string, edits: ProposedEdit[]): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return;

    for (const e of edits) {
      const beforeUri = makeBeforeUri(sessionId, e.filePath);
      const afterUri = makeAfterUri(sessionId, e.filePath);

      let beforeText = '';
      try {
        const abs = path.join(folder.uri.fsPath, e.filePath);
        beforeText = await fs.readFile(abs, 'utf8');
      } catch {
        beforeText = '';
      }

      beforeProvider.set(beforeUri, beforeText);
      afterProvider.set(afterUri, e.newText);
    }
  }

  async function previewDiff(sessionId: string, filePath: string): Promise<void> {
    const beforeUri = makeBeforeUri(sessionId, filePath);
    const afterUri = makeAfterUri(sessionId, filePath);
    await vscode.commands.executeCommand('vscode.diff', beforeUri, afterUri, `CodeMaestro Diff: ${filePath}`);
  }

  async function applyAllEdits(): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder || !state.sessionId) return;

    const res = await applyProposedEdits({ workspaceRoot: folder.uri.fsPath, edits: state.lastEdits });
    client.send({ type: 'APPLY_EDIT_RESULT', sessionId: state.sessionId, payload: res });
  }

  async function setProviderKey(): Promise<void> {
    const provider = await vscode.window.showQuickPick(['openai', 'anthropic', 'gemini'], {
      title: 'Select provider to store API key',
    });
    if (!provider) return;
    const key = await vscode.window.showInputBox({
      title: `Enter ${provider} API key`,
      password: true,
      ignoreFocusOut: true,
    });
    if (!key) return;
    await context.secrets.store(`codemaestro.key.${provider}`, key);
    void vscode.window.showInformationMessage(`Stored API key for ${provider}.`);
  }

  async function clearProviderKey(): Promise<void> {
    const provider = await vscode.window.showQuickPick(['openai', 'anthropic', 'gemini'], {
      title: 'Select provider to clear API key',
    });
    if (!provider) return;
    await context.secrets.delete(`codemaestro.key.${provider}`);
    void vscode.window.showInformationMessage(`Cleared API key for ${provider}.`);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('codemaestro.openChat', openChat),
    vscode.commands.registerCommand('codemaestro.startSession', startSession),
    vscode.commands.registerCommand('codemaestro.setProviderKey', setProviderKey),
    vscode.commands.registerCommand('codemaestro.clearProviderKey', clearProviderKey),
  );
}

export function deactivate(): void {
  // no-op
}
