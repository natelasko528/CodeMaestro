import * as vscode from 'vscode';

export class InMemoryContentProvider implements vscode.TextDocumentContentProvider {
  private readonly content = new Map<string, string>();
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();

  readonly onDidChange = this.emitter.event;

  set(uri: vscode.Uri, text: string): void {
    this.content.set(uri.toString(), text);
    this.emitter.fire(uri);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.content.get(uri.toString()) ?? '';
  }
}

export function makeBeforeUri(sessionId: string, filePath: string): vscode.Uri {
  return vscode.Uri.parse(`codemaestro-before:/${encodeURIComponent(sessionId)}/${encodeURIComponent(filePath)}`);
}

export function makeAfterUri(sessionId: string, filePath: string): vscode.Uri {
  return vscode.Uri.parse(`codemaestro-after:/${encodeURIComponent(sessionId)}/${encodeURIComponent(filePath)}`);
}
