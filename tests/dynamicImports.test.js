/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');

function listJsFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listJsFiles(full));
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

const IMPORT_RE = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

describe('goreli dinamik importlar', () => {
  it('hepsi mevcut dosyaya isaret eder', () => {
    const missing = [];
    let checked = 0;

    for (const file of listJsFiles(ROOT)) {
      const code = readFileSync(file, 'utf8');
      for (const match of code.matchAll(IMPORT_RE)) {
        const spec = match[1];
        if (!spec.startsWith('.')) continue;
        checked += 1;
        const target = resolve(dirname(file), spec);
        if (!existsSync(target)) {
          missing.push(`${file.slice(ROOT.length)} -> ${spec}`);
        }
      }
    }

    expect(checked).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });
});
