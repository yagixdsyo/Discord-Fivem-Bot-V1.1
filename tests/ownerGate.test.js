/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect } from 'vitest';
import { GATE_CODES, decideGate } from '../src/core/ownerGate.js';

const GUILD = '111111111111111111';
const OTHER = '222222222222222222';

describe('decideGate', () => {
  it('temiz durumda null doner', () => {
    expect(
      decideGate({
        guildId: GUILD,
        blacklistIds: [],
        guildState: { deactivated: null, disabledCommands: [], commandMaintenance: {}, moduleMaintenance: {} },
        globalState: { pause: null, maintenance: null },
        commandName: 'ping',
        moduleId: 'core',
      }),
    ).toBeNull();
  });

  it('DM (guildId yok) hicbir zaman engellenmez', () => {
    expect(
      decideGate({
        guildId: null,
        blacklistIds: [GUILD],
        guildState: { deactivated: { reason: 'x' } },
        globalState: { pause: { reason: 'y' } },
      }),
    ).toBeNull();
  });

  it('kara liste herkesi engeller (owner dahil) ve ilk sirada', () => {
    const result = decideGate({
      guildId: GUILD,
      blacklistIds: [GUILD],
      guildState: { deactivated: { reason: 'bakim' } },
      globalState: { pause: { reason: 'durduruldu' } },
      isOwner: true,
      commandName: 'ping',
    });
    expect(result).toEqual({ code: GATE_CODES.BLACKLISTED });
  });

  it('baska sunucunun kara listesi etkilemez', () => {
    expect(
      decideGate({ guildId: GUILD, blacklistIds: [OTHER], guildState: {} }),
    ).toBeNull();
  });

  it('deaktif sunucu kullaniciyi engeller, owner serbest', () => {
    const guildState = { deactivated: { reason: 'spam' }, disabledCommands: [], commandMaintenance: {}, moduleMaintenance: {} };
    expect(decideGate({ guildId: GUILD, guildState, isOwner: false })).toEqual({
      code: GATE_CODES.DEACTIVATED,
      reason: 'spam',
    });
    expect(decideGate({ guildId: GUILD, guildState, isOwner: true })).toBeNull();
  });

  it('global duraklatma kullaniciyi engeller, owner serbest', () => {
    const globalState = { pause: { reason: 'yogunluk' }, maintenance: null };
    expect(decideGate({ guildId: GUILD, globalState })).toEqual({
      code: GATE_CODES.GLOBAL_PAUSED,
      reason: 'yogunluk',
    });
    expect(decideGate({ guildId: GUILD, globalState, isOwner: true })).toBeNull();
  });

  it('global bakim bitis bilgisiyle doner, owner serbest', () => {
    const globalState = { pause: null, maintenance: { until: 123456, reason: 'guncelleme' } };
    expect(decideGate({ guildId: GUILD, globalState })).toEqual({
      code: GATE_CODES.GLOBAL_MAINTENANCE,
      until: 123456,
      reason: 'guncelleme',
    });
    expect(decideGate({ guildId: GUILD, globalState, isOwner: true })).toBeNull();
  });

  it('kapatilmis komut kullaniciyi engeller, owner muaf', () => {
    const guildState = { disabledCommands: ['bilet'], commandMaintenance: {}, moduleMaintenance: {} };
    expect(decideGate({ guildId: GUILD, guildState, commandName: 'bilet' })).toEqual({
      code: GATE_CODES.COMMAND_DISABLED,
      detail: 'bilet',
    });
    expect(decideGate({ guildId: GUILD, guildState, commandName: 'ping' })).toBeNull();
    expect(decideGate({ guildId: GUILD, guildState, commandName: 'bilet', isOwner: true })).toBeNull();
  });

  it('bakimdaki komut kullaniciyi engeller, owner muaf', () => {
    const guildState = { disabledCommands: [], commandMaintenance: { bilet: { until: null } }, moduleMaintenance: {} };
    expect(decideGate({ guildId: GUILD, guildState, commandName: 'bilet' })).toEqual({
      code: GATE_CODES.COMMAND_MAINTENANCE,
      until: null,
      detail: 'bilet',
    });
    expect(decideGate({ guildId: GUILD, guildState, commandName: 'bilet', isOwner: true })).toBeNull();
  });

  it('bakimdaki modul kullaniciyi engeller, owner muaf', () => {
    const guildState = { disabledCommands: [], commandMaintenance: {}, moduleMaintenance: { bilet: { until: 99 } } };
    expect(decideGate({ guildId: GUILD, guildState, moduleId: 'bilet' })).toEqual({
      code: GATE_CODES.MODULE_MAINTENANCE,
      until: 99,
      detail: 'bilet',
    });
    expect(decideGate({ guildId: GUILD, guildState, moduleId: 'bilet', isOwner: true })).toBeNull();
  });

  it('guildState/globalState verilmezse guvenli varsayilan kullanir', () => {
    expect(decideGate({ guildId: GUILD })).toBeNull();
    expect(decideGate({})).toBeNull();
  });
});
