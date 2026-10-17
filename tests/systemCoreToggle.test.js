/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const rows = vi.hoisted(() => new Map());

vi.mock('../src/db/index.js', () => ({
  isDbReady: () => true,
  getCollection: () => ({
    findOne: async (filter) => rows.get(`${filter.guild_id}:${filter.module_id}`) ?? null,
    updateOne: async () => ({ acknowledged: true }),
  }),
}));

import { registerModule } from '../src/core/moduleRegistry.js';
import {
  clearSystems,
  isCommandActive,
  isSystemActive,
  registerSystems,
} from '../src/core/systemRegistry.js';
import { SYSTEMS } from '../src/modules/setup/lib/systems.js';

const GUILD = '222222222222222222';

beforeEach(() => {
  rows.clear();
  clearSystems();
  registerSystems(SYSTEMS);
  registerModule({ id: 'guard', name: 'Guard', coreModule: true });
  registerModule({ id: 'backup', name: 'Backup', defaultEnabled: true });
});

describe('core sistem kapatilabilirligi', () => {
  it('satir yokken guard varsayilan acik', async () => {
    expect(await isSystemActive({ guildId: GUILD, systemId: 'guard' })).toBe(true);
  });

  it('guard satiri kapaliysa sistem kapali (core erken donusu regresyonu)', async () => {
    rows.set(`${GUILD}:guard`, { guild_id: GUILD, module_id: 'guard', enabled: false });
    expect(await isSystemActive({ guildId: GUILD, systemId: 'guard' })).toBe(false);

    rows.set(`${GUILD}:guard`, { guild_id: GUILD, module_id: 'guard', enabled: true });
    expect(await isSystemActive({ guildId: GUILD, systemId: 'guard' })).toBe(true);
  });

  it('guard komutlari sistem kapaliyken bloklanir', async () => {
    rows.set(`${GUILD}:guard`, { guild_id: GUILD, module_id: 'guard', enabled: false });
    expect(
      await isCommandActive({ guildId: GUILD, command: { module: 'guard', system: 'guard' } }),
    ).toBe(false);

    rows.set(`${GUILD}:guard`, { guild_id: GUILD, module_id: 'guard', enabled: true });
    expect(
      await isCommandActive({ guildId: GUILD, command: { module: 'guard', system: 'guard' } }),
    ).toBe(true);
  });

  it('core olmayan ayni-id sistem modul satirini paylasir (backup)', async () => {
    rows.set(`${GUILD}:backup`, { guild_id: GUILD, module_id: 'backup', enabled: false });
    expect(await isSystemActive({ guildId: GUILD, systemId: 'backup' })).toBe(false);
  });
});
