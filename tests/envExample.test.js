/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const EXAMPLE = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

function valueOf(key) {
  const m = EXAMPLE.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : null;
}

const SECRET_KEYS = [
  'BOT_TOKEN',
  'BOT_FIVEM_TOKEN',
  'BOT_PUBLIC_TOKEN',
  'BOT_GUARD_TOKEN',
  'BOT_TICKET_TOKEN',
  'BOT_YETKIKONTROL_TOKEN',
  'SITE_API_TOKEN',
  'SITE_UPLOAD_TOKEN',
  'NVIDIA_API_KEY',
  'SOURCEBIN_TOKEN',
];

describe('.env.example', () => {
  it('sir anahtarlari bos (token/anahtar degeri icermez)', () => {
    for (const key of SECRET_KEYS) {
      const value = valueOf(key);
      expect(value, `${key} ornek dosyada tanimli olmali`).not.toBeNull();
      expect(value, `${key} ornek dosyada BOS olmali`).toBe('');
    }
  });

  it('token benzeri deger hicbir satirda yok', () => {
    // Discord token formati: base64.base64.base64 benzeri uc parcali desen
    expect(EXAMPLE).not.toMatch(/^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}$/m);
  });

  it('zorunlu anahtarlar belgelenmis', () => {
    for (const key of [
      'MONGO_URI',
      'REDIS_URL',
      'EMOJI_SOURCE',
      'OWNER_IDS',
      'DEV_GUILD_ID',
      'FIVEM_WH_PORT',
      'NVIDIA_BASE_URL',
    ]) {
      expect(valueOf(key), `${key} ornek dosyada yok`).not.toBeNull();
    }
  });
});
