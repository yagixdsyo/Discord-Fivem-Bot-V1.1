/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import tr from '../src/locales/tr.json';
import { LOG_CHANNELS } from '../src/modules/setup/lib/catalog.js';
import { batchLogPayload, entryLines, singleLogPayload } from '../src/modules/logging/lib/format.js';
import { LOG_EMOJI, logAccent, logEmojiKey } from '../src/modules/logging/lib/palette.js';

const V2_FLAG = 1 << 15;
const PICTOGRAPHIC_RE = /\p{Extended_Pictographic}/u;
const EMOJI_TAG_RE = /<a?:[A-Za-z0-9_]+:\d+>/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.js')) out.push(full);
  }
  return out;
}

describe('singleLogPayload', () => {
  it('V2 bayragi ve zorunlu alanlari icerir', () => {
    const payload = singleLogPayload({
      key: 'log_ban',
      guildName: 'Test Sunucusu',
      entry: {
        actor: '111111111111111111',
        actorTag: 'yetkili',
        target: '222222222222222222',
        targetTag: 'biri',
        reason: 'kural ihlali',
        ids: [['Üye', '222222222222222222']],
        at: 1_700_000_000_000,
      },
    });

    expect(payload.flags & V2_FLAG).toBe(V2_FLAG);
    expect(payload.allowedMentions).toEqual({ parse: [] });

    const json = JSON.stringify(payload);
    expect(json).toContain('Yasaklama');
    expect(json).toContain('<@111111111111111111>');
    expect(json).toContain('<@222222222222222222>');
    expect(json).toContain('kural ihlali');
    expect(json).toContain('222222222222222222');
    expect(json).toContain('<t:1700000000');
  });

  it('bilinmeyen anahtar icin baslik anahtara duser ve yine de payload uretir', () => {
    const payload = singleLogPayload({ key: 'log_olmayan', guildName: 'X', entry: {} });
    expect(payload.components.length).toBe(1);
  });
});

describe('batchLogPayload', () => {
  it('birden fazla kaydi tek mesajda birlestirir', () => {
    const items = [
      { key: 'log_ban', entry: { actor: '111111111111111111', at: Date.now() } },
      { key: 'log_kick', entry: { actor: '111111111111111111', at: Date.now() } },
      { key: 'log_mute', entry: { actor: '111111111111111111', at: Date.now() } },
    ];
    const payload = batchLogPayload({ items, guildName: 'Test' });
    expect(payload.flags & V2_FLAG).toBe(V2_FLAG);
    const json = JSON.stringify(payload);
    expect(json).toContain('3 kayıt');
    expect(json).toContain('Yasaklama');
    expect(json).toContain('Atılma (Kick)');
    expect(json).toContain('Susturma');
  });
});

describe('entryLines', () => {
  it('ID alanlarini kopyalanabilir bicimde yazar', () => {
    const lines = entryLines({ ids: [['Kanal', '333333333333333333']], at: 0 });
    expect(lines.join('\n')).toContain('`333333333333333333`');
  });

  it('rol/channel mention metinlerini bozmaz', () => {
    const lines = entryLines({ target: '<@&444444444444444444>', at: 0 });
    expect(lines.join('\n')).toContain('<@&444444444444444444>');
  });
});

describe('locale ve palet sozlesmesi', () => {
  it('her log kanalinin locale basligi var', () => {
    const titles = tr.log?.titles ?? {};
    const missing = LOG_CHANNELS.map((channel) => channel.key).filter((key) => !titles[key]);
    expect(missing).toEqual([]);
  });

  it('palet yalnizca tanimli emoji anahtarlari kullanir', async () => {
    const { EMOJI_KEYS } = await import('../src/ui/emojiKeys.js');
    const known = new Set(EMOJI_KEYS);
    const unknown = Object.values(LOG_EMOJI).filter((key) => !known.has(key));
    expect(unknown).toEqual([]);
  });

  it('bilinmeyen anahtar guvenli varsayilan doner', () => {
    expect(logEmojiKey('log_yok')).toBe('BELGE');
    expect(logAccent('log_yok')).toBe('info');
  });
});

describe('kaynak taramasi', () => {
  it('logging modulunde sabit emoji yok (kabul kriteri 2)', () => {
    const files = walk(path.join(process.cwd(), 'src', 'modules', 'logging'));
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(EMOJI_TAG_RE.test(content), `${file} emoji tag iceriyor`).toBe(false);
      expect(PICTOGRAPHIC_RE.test(content), `${file} emoji karakter iceriyor`).toBe(false);
    }
  });
});
