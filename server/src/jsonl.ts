export type JsonlLineHandler = (obj: unknown) => void;

export class JsonlParser {
  private buffer = '';

  feed(chunk: Buffer | string, onLine: JsonlLineHandler): void {
    this.buffer += chunk.toString();
    let idx = this.buffer.indexOf('\n');
    while (idx !== -1) {
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      const trimmed = line.trim();
      if (!trimmed) {
        idx = this.buffer.indexOf('\n');
        continue;
      }
      let obj: unknown;
      try {
        obj = JSON.parse(trimmed);
      } catch {
        onLine({ type: '__PARSE_ERROR__', raw: trimmed });
        idx = this.buffer.indexOf('\n');
        continue;
      }
      onLine(obj);
      idx = this.buffer.indexOf('\n');
    }
  }
}

export function stringifyJsonl(obj: unknown): string {
  return `${JSON.stringify(obj)}\n`;
}
