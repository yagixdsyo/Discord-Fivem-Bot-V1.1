/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { readFileSync } from 'node:fs';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.js') || entry.endsWith('.yaml') || entry.endsWith('.json')) out.push(full);
  }
  return out;
}

describe('faz10 hardening', () => {
  it('site hedefleri mevcut', () => {
    expect(existsSync(join(ROOT, 'src/web/openapi.yaml'))).toBe(true);
    expect(existsSync(join(ROOT, 'src/web/siteClient.js'))).toBe(true);
  });

  it('.env.example site anahtarlarini icerir', () => {
    const env = readFileSync(join(ROOT, '.env.example'), 'utf8');
    expect(env).toContain('SITE_API_BASE_URL=');
    expect(env).toContain('SITE_API_TOKEN=');
    expect(env).toContain('SITE_API_TIMEOUT_MS=');
  });

  it('kurulum dokumani ve README mevcut', () => {
    expect(existsSync(join(ROOT, 'README.md'))).toBe(true);
    expect(existsSync(join(ROOT, 'docs/KURULUM.md'))).toBe(true);
  });

  it('kaynakta hardcoded Unicode emoji karakteri yok (statik tarama)', () => {
    const srcRoot = join(ROOT, 'src');
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const offenders = [];
    for (const file of walk(srcRoot)) {
      const src = readFileSync(file, 'utf8');
      if (emojiRegex.test(src)) offenders.push(relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});
