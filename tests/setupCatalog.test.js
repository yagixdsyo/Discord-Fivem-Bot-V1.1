/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  CATEGORIES,
  CHANNELS,
  LOG_CHANNELS,
  MAX_CHANNELS_PER_CATEGORY,
  PACKAGES,
  ROLES,
  SYSTEMS,
} from '../src/modules/setup/lib/catalog.js';
import { buildSetupPlan } from '../src/modules/setup/lib/plan.js';

const EMOJI_TAG_RE = /<a?:[A-Za-z0-9_]+:\d+>/;
const PICTOGRAPHIC_RE = /\p{Extended_Pictographic}/u;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.js')) out.push(full);
  }
  return out;
}

describe('setup katalogu', () => {
  it('rol anahtarlari essiz ve dolu', () => {
    const keys = ROLES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const role of ROLES) {
      expect(role.name.length).toBeGreaterThan(0);
      expect(role.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('rol listesini kapsar (guard_safe 1..4 dahil)', () => {
    const keys = new Set(ROLES.map((r) => r.key));
    for (const expected of [
      'yetkili',
      'ust_yetkili',
      'yonetici',
      'moderator',
      'destek',
      'mulakatci',
      'kayit_yetkilisi',
      'whitelist',
      'kayitsiz',
      'blacklist',
      'mesai',
      'legal_ekip',
      'illegal_ekip',
      'patron',
      'boss',
      'ban_yetkilisi',
      'guard_safe_1',
      'guard_safe_2',
      'guard_safe_3',
      'guard_safe_4',
      'susturulmus',
      'etkinlik_yasagi',
      'arac_yasagi',
      'oto_rol',
    ]) {
      expect(keys.has(expected), `eksik rol: ${expected}`).toBe(true);
    }
  });

  it('kanal anahtarlari essiz', () => {
    const keys = [...CHANNELS, ...LOG_CHANNELS].map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('her kanal tanimli bir kategoriye bagli', () => {
    const categoryKeys = new Set(CATEGORIES.map((c) => c.key));
    for (const channel of [...CHANNELS, ...LOG_CHANNELS]) {
      expect(categoryKeys.has(channel.category), `bilinmeyen kategori: ${channel.key}`).toBe(true);
    }
  });

  it('log kanali listesi + 15 sorgu logu toplamina sahip (63)', () => {
    expect(LOG_CHANNELS.length).toBe(63);
    expect(LOG_CHANNELS.some((c) => c.key === 'log_sorgu')).toBe(true);
  });

  it('kategoriler kategori basina 50 kanal sinirinda bolunur', () => {
    const plan = buildSetupPlan({ packages: 'hepsi' });
    const counts = new Map();
    for (const channel of plan.channels) {
      counts.set(channel.category, (counts.get(channel.category) ?? 0) + 1);
    }
    for (const count of counts.values()) {
      expect(count).toBeLessThanOrEqual(MAX_CHANNELS_PER_CATEGORY);
    }
    const logNames = plan.categories.filter((c) => c.name.startsWith('LOG')).map((c) => c.name);
    expect(logNames).toEqual(['LOG', 'LOG 2']);
  });

  it('sistemler essiz kimlige ve sahip modul bilgisine sahip', () => {
    const ids = SYSTEMS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const system of SYSTEMS) {
      expect(system.name.length).toBeGreaterThan(0);
      expect('moduleId' in system).toBe(true);
    }
  });

  it('sihirbaz paketleri listesiyle ayni', () => {
    expect(PACKAGES.map((p) => p.id)).toEqual([
      'guard',
      'moderasyon',
      'fivem',
      'ticket',
      'ekip_mesai',
      'basvuru',
      'hepsi',
    ]);
  });

  it('kaynakta sabit emoji yok (kabul kriteri 2)', () => {
    const files = [
      ...walk(path.join(process.cwd(), 'src', 'modules', 'setup')),
      path.join(process.cwd(), 'src', 'core', 'systemRegistry.js'),
    ];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(EMOJI_TAG_RE.test(content), `${file} emoji tag iceriyor`).toBe(false);
      expect(PICTOGRAPHIC_RE.test(content), `${file} emoji karakter iceriyor`).toBe(false);
    }
  });
});
