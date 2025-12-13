const SENSITIVE_KEY_RE = /(key|token|secret|password)/i;

export function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    // Heuristic: don’t attempt to detect secrets in arbitrary strings in MVP.
    return value;
  }
  return value;
}

export function redactObject<T>(input: T): T {
  return deepRedact(input) as T;
}

function deepRedact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepRedact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = deepRedact(v);
      }
    }
    return out;
  }
  return redactValue(value);
}
