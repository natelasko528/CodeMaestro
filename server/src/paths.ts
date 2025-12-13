import path from 'node:path';

export function assertSafeRelativePath(filePath: string): void {
  // Must be relative
  if (path.isAbsolute(filePath)) throw new Error('filePath must be relative');

  const normalized = path.posix.normalize(filePath.split(path.win32.sep).join(path.posix.sep));
  if (normalized.startsWith('../') || normalized === '..') throw new Error('filePath must not escape workspace root');
  if (normalized.includes('/../')) throw new Error('filePath must not escape workspace root');
}

export function resolveInside(root: string, rel: string): string {
  assertSafeRelativePath(rel);
  return path.resolve(root, rel);
}
