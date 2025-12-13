import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err && err.code === 'ENOENT') return null;
    throw e;
  }
}

export async function writeText(filePath: string, text: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, text, 'utf8');
}
