/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

process.env.LOG_LEVEL = 'silent';

import { describe, it, expect, beforeAll } from 'vitest';
import { initEmoji } from '../src/ui/emoji.js';
import { setDefaultPrefix } from '../src/core/guildSettings.js';
import {
  initLoader,
  buildInstanceRegistry,
  getLoaderSummary,
  matchesBotType,
} from '../src/core/loader.js';

beforeAll(async () => {
  initEmoji({ source: 'guild', map: {}, missingKeys: [] });
  setDefaultPrefix('.');
  await initLoader();
});

describe('loader', () => {
  it('gercek modulleri yukler', () => {
    const summary = getLoaderSummary();
    expect(summary.moduleIds).toContain('core');
    expect(summary.commands).toBeGreaterThanOrEqual(2);
  });

  it('core komutlari registry uzerinden erisilebilir', () => {
    const registry = buildInstanceRegistry('fivem');
    expect(registry.commands.has('yardım')).toBe(true);
    expect(registry.commands.has('ping')).toBe(true);
    expect(registry.commandList.length).toBeGreaterThanOrEqual(2);
  });

  it('kisayol aramasi komutu bulur', () => {
    const registry = buildInstanceRegistry('fivem');
    expect(registry.aliases.get('help')?.name).toBe('yardım');
    expect(registry.aliases.get('yardim')?.name).toBe('yardım');
    expect(registry.aliases.get('komutlar')?.name).toBe('yardım');
  });

  it('owner komutlari normal komut listesine sizmaz', () => {
    const registry = buildInstanceRegistry('fivem');
    expect(registry.commandList.some((cmd) => cmd.ownerOnly)).toBe(false);
  });

  it('komutlar modul bilgisi ve dogrulanmis ad tasir', () => {
    const registry = buildInstanceRegistry('fivem');
    for (const cmd of registry.commandList) {
      expect(cmd.module).toBeTruthy();
      expect(typeof cmd.run === 'function' || Array.isArray(cmd.subcommands)).toBe(true);
    }
  });

  it('owner komutlari modul komutlariyla ayni isimde yasayabilir (! ve . ayri alanlar)', () => {
    const registry = buildInstanceRegistry('fivem');
    for (const name of ['yardım', 'bakım', 'bot-bilgi', 'güncelleme', 'yenilik']) {
      expect(registry.ownerCommands.has(name), `owner komutu eksik: ${name}`).toBe(true);
      expect(registry.commands.has(name), `modul komutu eksik: ${name}`).toBe(true);
    }
  });

  it('owner komutlari tam yuklenir (isim cakismasi olanlar dahil)', () => {
    const registry = buildInstanceRegistry('fivem');
    // 36 owner komut dosyasi var; bir tanesi bile sessizce dusse bu test yakalar.
    expect(registry.ownerCommands.size).toBeGreaterThanOrEqual(36);
  });

  it('matchesBotType all/ozel tip davranisi', () => {
    expect(matchesBotType(['all'], 'fivem')).toBe(true);
    expect(matchesBotType(['fivem'], 'fivem')).toBe(true);
    expect(matchesBotType(['guard'], 'fivem')).toBe(false);
    expect(matchesBotType(undefined, 'fivem')).toBe(true);
    expect(matchesBotType([], 'fivem')).toBe(true);
  });

  it('initLoader ikinci cagride yeniden yukleme yapmaz (idempotent)', async () => {
    const before = getLoaderSummary();
    await initLoader();
    const after = getLoaderSummary();
    expect(after.commands).toBe(before.commands);
    expect(after.modules).toBe(before.modules);
  });
});
