/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, expect, it } from 'vitest';
import { LOG_CHANNELS, ROLES } from '../src/modules/setup/lib/catalog.js';
import { buildSetupPlan, makePackageSet, matchesPackage } from '../src/modules/setup/lib/plan.js';

describe('makePackageSet', () => {
  it('bos secim varsayilan olarak hepsi olur', () => {
    expect([...makePackageSet(undefined)]).toEqual(['hepsi']);
    expect([...makePackageSet([])]).toEqual(['hepsi']);
  });

  it('tekil ve dizi girdileri normalize edilir', () => {
    expect([...makePackageSet('ticket')]).toEqual(['ticket']);
    expect([...makePackageSet(['guard', 'ticket'])]).toEqual(['guard', 'ticket']);
  });
});

describe('matchesPackage', () => {
  it('paketsiz (temel) ogeler her zaman dahildir', () => {
    expect(matchesPackage({ key: 'x' }, new Set(['ticket']))).toBe(true);
  });

  it('hepsi secildiğinde paketli ogeler dahildir', () => {
    expect(matchesPackage({ package: 'guard' }, new Set(['hepsi']))).toBe(true);
  });

  it('yalnizca secili paketin ogeleri dahildir', () => {
    expect(matchesPackage({ package: 'guard' }, new Set(['ticket']))).toBe(false);
    expect(matchesPackage({ package: 'ticket' }, new Set(['ticket']))).toBe(true);
  });
});

describe('buildSetupPlan', () => {
  it('hepsi: tum roller, kanallar ve loglar plana girer', () => {
    const plan = buildSetupPlan({ packages: 'hepsi' });
    expect(plan.roles.length).toBe(ROLES.length);
    expect(plan.stats.logs).toBe(LOG_CHANNELS.length);
    expect(plan.stats.roles).toBe(ROLES.length);
    expect(plan.stats.voices).toBe(4);
    expect(plan.channels.length).toBe(plan.stats.channels);
  });

  it('sadece ticket: guard/moderasyon/fivem ogeleri disarida kalir', () => {
    const plan = buildSetupPlan({ packages: ['ticket'] });
    const roleKeys = new Set(plan.roles.map((r) => r.key));
    expect(roleKeys.has('guard_safe_1')).toBe(false);
    expect(roleKeys.has('moderator')).toBe(false);
    expect(roleKeys.has('kayit_yetkilisi')).toBe(false);
    expect(roleKeys.has('destek')).toBe(true);
    // Temel loglar kalir; guard loglari kalkar.
    const logKeys = plan.channels.filter((c) => c.key.startsWith('log_')).map((c) => c.key);
    expect(logKeys).toContain('log_guild_update');
    expect(logKeys).not.toContain('log_guard');
    expect(logKeys).toContain('log_ticket');
    // Guard kategorisi olusmaz.
    expect(plan.categories.some((c) => c.name === 'GUARD')).toBe(false);
  });

  it('guard paketi: guard rolleri ve loglari gelir, ticket rolleri gelmez', () => {
    const plan = buildSetupPlan({ packages: 'guard' });
    const roleKeys = new Set(plan.roles.map((r) => r.key));
    expect(roleKeys.has('guard_safe_4')).toBe(true);
    expect(roleKeys.has('destek')).toBe(false);
    const logKeys = plan.channels.map((c) => c.key);
    expect(logKeys).toContain('log_guard');
    expect(logKeys).not.toContain('log_ticket');
  });

  it('ayarlar opsiyonlardan turetilir', () => {
    const plan = buildSetupPlan({
      packages: 'hepsi',
      options: { cfxCode: 'abc123', serverIp: '1.2.3.4:30120', otoRolId: '111', yetkiliRolId: '222' },
    });
    expect(plan.settings.cfxCode).toBe('abc123');
    expect(plan.settings.serverIp).toBe('1.2.3.4:30120');
    expect(plan.settings.otoRolId).toBe('111');
    expect(plan.settings.yetkiliRolId).toBe('222');
    expect(plan.settings.packages).toEqual(['hepsi']);
  });

  it('bos opsiyon degerleri ayara yazilmaz', () => {
    const plan = buildSetupPlan({ packages: 'hepsi', options: { cfxCode: '  ', serverIp: '' } });
    expect(plan.settings.cfxCode).toBeUndefined();
    expect(plan.settings.serverIp).toBeUndefined();
  });
});
