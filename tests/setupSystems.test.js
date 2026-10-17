/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { registerModule } from '../src/core/moduleRegistry.js';
import {
  clearSystems,
  getGuildSystemList,
  getSystem,
  isCommandActive,
  isSystemActive,
  commandGateLabel,
  registerSystems,
  setSystemEnabled,
} from '../src/core/systemRegistry.js';
import { normalizeTr, resolveSystem, SYSTEMS } from '../src/modules/setup/lib/systems.js';

const GUILD = '111111111111111111';

describe('setup sistem katalogu', () => {
  it('katalog sistemleri icerir ve id-sahip modul iliskisi tutarli', () => {
    const byId = new Map(SYSTEMS.map((s) => [s.id, s]));
    // 10.5 tablosundaki ana sistemler
    for (const id of [
      'guard',
      'backup',
      'moderasyon',
      'ticket',
      'kayit',
      'whitelist',
      'mesai',
      'mazeret',
      'ekip',
      'basvuru',
      'blacklist',
      'loglar',
      'oto_rol',
      'duyuru',
    ]) {
      expect(byId.has(id), `eksik sistem: ${id}`).toBe(true);
    }
    // modulleri de sistem katmaninda yonetilebilir
    for (const id of ['sicil', 'karar', 'gorev', 'ani', 'izin', 'analitik', 'yetkikontrol']) {
      expect(byId.has(id), `eksik sistem: ${id}`).toBe(true);
      expect(byId.get(id).moduleId, `modul eslesmesi: ${id}`).toBe(id);
    }
    // guard sistemi moduluyle ayni satiri paylasir
    expect(byId.get('guard').moduleId).toBe('guard');
    expect(SYSTEMS.length).toBeGreaterThanOrEqual(32);
  });

  it('resolveSystem: id, ad ve modul id ile bulur; turkce normalizasyon calisir', () => {
    expect(resolveSystem('guard')?.id).toBe('guard');
    expect(resolveSystem('Guard (Koruma)')?.id).toBe('guard');
    expect(resolveSystem('mesai')?.id).toBe('mesai');
    expect(resolveSystem('Özel Oda')?.id).toBe('ozel_oda');
    expect(resolveSystem('ozel-oda')?.id).toBe('ozel_oda');
    expect(resolveSystem('Mülakat')?.id).toBe('mulakat');
    expect(resolveSystem('moderation')?.id).toBe('moderasyon');
    expect(resolveSystem('bilinmeyen-sistem')).toBeNull();
  });

  it('normalizeTr turkce karakterleri esitler', () => {
    expect(normalizeTr('ÇĞİÖŞÜ')).toBe('cgiosu');
  });
});

describe('systemRegistry gating', () => {
  beforeEach(() => {
    clearSystems();
    registerSystems(SYSTEMS);
  });

  it('DB yokken sistem varsayilan (acik) doner', async () => {
    registerModule({ id: 'duyuru', name: 'Duyurular', defaultEnabled: true });
    expect(await isSystemActive({ guildId: GUILD, systemId: 'duyuru' })).toBe(true);
  });

  it('tanimsiz sistem her zaman kapalidir', async () => {
    expect(await isSystemActive({ guildId: GUILD, systemId: 'yok-boyle' })).toBe(false);
  });

  it('sahip modul varsayilan kapaliysa sistem de kapalidir', async () => {
    registerModule({ id: 'guard', name: 'Guard', defaultEnabled: false });
    expect(await isSystemActive({ guildId: GUILD, systemId: 'guard' })).toBe(false);
  });

  it('sahip modul kapaliysa alt sistem de kapalidir', async () => {
    registerModule({ id: 'shift', name: 'Mesai Sistemi', defaultEnabled: false });
    expect(await isSystemActive({ guildId: GUILD, systemId: 'mazeret' })).toBe(false);
  });

  it('setSystemEnabled DB hazir degilse hata doner', async () => {
    const result = await setSystemEnabled({ guildId: GUILD, systemId: 'duyuru', enabled: false });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('db_hazir_degil');
  });

  it('setSystemEnabled tanimsiz sistem icin sistem_yok doner', async () => {
    const result = await setSystemEnabled({ guildId: GUILD, systemId: 'yok', enabled: false });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('sistem_yok');
  });

  it('isCommandActive: system tanimliysa sistem, degilse modul katmani', async () => {
    registerModule({ id: 'core', name: 'Cekirdek', coreModule: true });
    registerModule({ id: 'duyuru', name: 'Duyurular', defaultEnabled: true });
    expect(await isCommandActive({ guildId: GUILD, command: { module: 'core' } })).toBe(true);
    // Kayitli olmayan modul: modul katmani reddeder
    expect(await isCommandActive({ guildId: GUILD, command: { module: 'bilinmeyen-modul' } })).toBe(false);
    // system tanimliysa sistem katmani belirler
    expect(
      await isCommandActive({ guildId: GUILD, command: { module: 'bilinmeyen-modul', system: 'duyuru' } }),
    ).toBe(true);
    // sistemin sahip modulu kapaliysa komut kapalidir
    registerModule({ id: 'shift', name: 'Mesai Sistemi', defaultEnabled: false });
    expect(
      await isCommandActive({ guildId: GUILD, command: { module: 'shift', system: 'mazeret' } }),
    ).toBe(false);
  });

  it('commandGateLabel sistem adini tercih eder', () => {
    registerModule({ id: 'guard', name: 'Guard Modulu' });
    expect(commandGateLabel({ module: 'guard', system: 'duyuru' })).toBe('Duyurular');
    expect(commandGateLabel({ module: 'guard' })).toBe('Guard Modulu');
    expect(commandGateLabel({ module: 'bilinmeyen' })).toBe('bilinmeyen');
  });

  it('getGuildSystemList katalogdaki tum sistemleri listeler', async () => {
    const list = await getGuildSystemList(GUILD);
    expect(list.length).toBe(SYSTEMS.length);
    for (const item of list) {
      expect(typeof item.enabled).toBe('boolean');
      expect(typeof item.moduleRegistered).toBe('boolean');
    }
  });

  it('getSystem bilinmeyen id icin null doner', () => {
    expect(getSystem('yok')).toBeNull();
  });
});
