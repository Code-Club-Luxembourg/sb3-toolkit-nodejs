import * as fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Resolve input paths to absolute paths and verify each file exists.
 */
export async function resolvePaths(paths: readonly string[]): Promise<string[]> {
  const resolved: string[] = [];
  for (const input of paths) {
    const fullPath = path.resolve(input);
    try {
      await fs.access(fullPath);
    } catch {
      throw new Error(`File not found: ${input}`);
    }
    resolved.push(fullPath);
  }
  return resolved;
}
