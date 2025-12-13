import * as vscode from 'vscode';

export function getWebviewHtml(webview: vscode.Webview): string {
  const nonce = String(Date.now());
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CodeMaestro</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; padding: 12px; }
      #log { white-space: pre-wrap; border: 1px solid #ddd; padding: 8px; height: 50vh; overflow: auto; }
      #prompt { width: 100%; }
      .row { display: flex; gap: 8px; margin-top: 8px; }
      button { padding: 6px 10px; }
      .edits { margin-top: 12px; border: 1px solid #ddd; padding: 8px; }
    </style>
  </head>
  <body>
    <h3>CodeMaestro (MVP)</h3>
    <div id="log"></div>
    <div class="row">
      <input id="prompt" type="text" placeholder="Type a prompt and press Send" />
      <button id="send">Send</button>
    </div>
    <div class="edits" id="edits" style="display:none"></div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const log = document.getElementById('log');
      const edits = document.getElementById('edits');
      const promptEl = document.getElementById('prompt');

      function append(line) {
        log.textContent += line + "\n";
        log.scrollTop = log.scrollHeight;
      }

      document.getElementById('send').addEventListener('click', () => {
        const text = promptEl.value || '';
        if (!text.trim()) return;
        vscode.postMessage({ type: 'USER_PROMPT', text });
        promptEl.value = '';
      });

      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg.type === 'LOG') {
          append(msg.text);
        }
        if (msg.type === 'PROPOSE_EDIT') {
          edits.style.display = 'block';
          edits.innerHTML = '';
          const title = document.createElement('div');
          title.textContent = 'Proposed edits (' + msg.edits.length + ' files)';
          edits.appendChild(title);

          msg.edits.forEach((e) => {
            const row = document.createElement('div');
            row.className = 'row';
            const label = document.createElement('div');
            label.textContent = e.filePath;
            label.style.flex = '1';
            const preview = document.createElement('button');
            preview.textContent = 'Preview';
            preview.onclick = () => vscode.postMessage({ type: 'PREVIEW_EDIT', filePath: e.filePath });
            row.appendChild(label);
            row.appendChild(preview);
            edits.appendChild(row);
          });

          const actions = document.createElement('div');
          actions.className = 'row';
          const apply = document.createElement('button');
          apply.textContent = 'Apply all';
          apply.onclick = () => vscode.postMessage({ type: 'APPLY_ALL' });
          const reject = document.createElement('button');
          reject.textContent = 'Reject';
          reject.onclick = () => vscode.postMessage({ type: 'REJECT_ALL' });
          actions.appendChild(apply);
          actions.appendChild(reject);
          edits.appendChild(actions);
        }
      });
    </script>
  </body>
</html>`;
}
