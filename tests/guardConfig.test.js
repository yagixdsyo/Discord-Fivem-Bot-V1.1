/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NIGHT_PERMS,
  GUARD_MODULES,
  PUNISH_TYPES,
  TIER_COVERAGE,
  defaultGuardConfig,
  getGuardConfig,
  invalidateGuardConfig,
  moduleDef,
  tierCovers,
} from '../src/modules/guard/lib/config.js';

describe('guard modulleri', () => {
  it('15 modul tanimli ve anahtarlar benzersiz', () => {
    expect(GUARD_MODULES.length).toBe(15);
    const keys = GUARD_MODULES.map((def) => def.key);
    expect(new Set(keys).size).toBe(15);
  });

  it('her modulun ceza/esik/pencere/log anahtari var', () => {
    for (const def of GUARD_MODULES) {
      expect(typeof def.name).toBe('string');
      expect(PUNISH_TYPES).toContain(def.defaultPunish);
      expect(def.defaultLimit).toBeGreaterThanOrEqual(1);
      expect(def.defaultWindow).toBeGreaterThanOrEqual(5);
      expect(def.logKey.startsWith('log_')).toBe(true);
    }
  });

  it('moduleDef bilinmeyen anahtarda null doner', () => {
    expect(moduleDef('rol')).not.toBeNull();
    expect(moduleDef('yok-boyle-modul')).toBeNull();
  });

  it('varsayilan config tum modulleri icerir', () => {
    const config = defaultGuardConfig();
    expect(Object.keys(config.modules).length).toBe(15);
    expect(config.modules.ban_kick.limit).toBe(4);
    expect(config.modules.ban_kick.window).toBe(60);
    expect(config.modules.guvenli_rol.punish).toBe('ban');
    expect(config.chatSafe.channels).toEqual([]);
    expect(config.chatSafe.blockAllLinks).toBe(false);
  });

  it('DB yokken getGuardConfig varsayilanlari doner', async () => {
    invalidateGuardConfig('999');
    const config = await getGuardConfig('999');
    expect(config.modules.icerik.enabled).toBe(true);
    expect(config.modules.icerik.limit).toBe(5);
  });
});

describe('guvenli kademe kapsami', () => {
  it('kademe 4 tum modullerden muaf (sahip/bot haric)', () => {
    expect(tierCovers(4, 'rol')).toBe(true);
    expect(tierCovers(4, 'ban_kick')).toBe(true);
    expect(tierCovers(4, 'davet_giris')).toBe(true);
  });

  it('kademe 1 yalnizca icerik muafiyeti', () => {
    expect(tierCovers(1, 'icerik')).toBe(true);
    expect(tierCovers(1, 'mention')).toBe(false);
    expect(tierCovers(1, 'rol')).toBe(false);
  });

  it('kademe 2 mention/emoji/mesaj koruma ekler', () => {
    expect(tierCovers(2, 'mention')).toBe(true);
    expect(tierCovers(2, 'mesaj_koruma')).toBe(true);
    expect(tierCovers(2, 'rol')).toBe(false);
    expect(tierCovers(2, 'ban_kick')).toBe(false);
  });

  it('kademe 3 rol/kanal islemlerini serbest birakir', () => {
    expect(tierCovers(3, 'rol')).toBe(true);
    expect(tierCovers(3, 'kanal')).toBe(true);
    expect(tierCovers(3, 'webhook')).toBe(true);
    expect(tierCovers(3, 'ban_kick')).toBe(false);
  });

  it('bilinmeyen kademe hicbir modulu kapsamaz', () => {
    expect(tierCovers(9, 'icerik')).toBe(false);
    expect(TIER_COVERAGE[4]).toBe('*');
  });
});

describe('gece modu izin listesi', () => {
  it('tehlikeli izinler listelenir', () => {
    expect(DEFAULT_NIGHT_PERMS).toContain('Administrator');
    expect(DEFAULT_NIGHT_PERMS).toContain('ManageRoles');
    expect(DEFAULT_NIGHT_PERMS).toContain('BanMembers');
  });
});
