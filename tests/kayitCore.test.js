/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { settingsStore } = vi.hoisted(() => ({ settingsStore: new Map() }));

vi.mock('../src/core/guildSettings.js', () => ({
  getGuildConfig: vi.fn(async (guildId) => ({ settings: settingsStore.get(guildId) ?? {} })),
  setGuildSetting: vi.fn(async (guildId, key, value) => {
    const settings = settingsStore.get(guildId) ?? {};
    settings[key] = value;
    settingsStore.set(guildId, settings);
    return true;
  }),
  invalidateGuildConfig: vi.fn(async () => {}),
}));

vi.mock('../src/modules/fivem/lib/maps.js', () => ({
  getChannelId: vi.fn(async () => null),
  getRoleId: vi.fn(async () => null),
  resolveChannel: vi.fn(async () => null),
  resolveRole: vi.fn(async () => null),
  clearMapsCache: vi.fn(),
}));

import { createTranslator } from '../src/locales/index.js';
import { clearSanctionMemory } from '../src/modules/guard/lib/sanction.js';
import { getRoleId } from '../src/modules/fivem/lib/maps.js';
import { clearFivemMemory } from '../src/modules/fivem/lib/store.js';
import { getByUser } from '../src/modules/fivem/lib/registration.js';
import {
  getKayitPanel,
  getKayitState,
  kayitInteractivePayload,
  refreshKayitPanel,
  registerMember,
  setKayitState,
  unregisterMember,
} from '../src/modules/fivem/lib/kayitFlow.js';

const t = createTranslator('tr');

const ROLE_IDS = { kayitli: 'r-kayitli', kayitsiz: 'r-kayitsiz', blacklist: 'r-black' };

function fakeMember({ id = 'm1', roles = [], accountDays = 365, username = 'hedef' } = {}) {
  const cache = new Map(roles.map((roleId) => [roleId, true]));
  return {
    id,
    user: { id, username, createdTimestamp: Date.now() - accountDays * 86_400_000 },
    roles: {
      cache,
      add: vi.fn(async (roleId) => {
        cache.set(roleId, true);
      }),
      remove: vi.fn(async (roleId) => {
        cache.delete(roleId);
      }),
    },
    setNickname: vi.fn(async () => {}),
  };
}

function fakeGuild({ id = 'g1', rolePosition = 5, botPosition = 50 } = {}) {
  const kayitliRole = { id: ROLE_IDS.kayitli, position: rolePosition };
  return {
    id,
    name: 'Test Sunucu',
    roles: {
      cache: new Map([[ROLE_IDS.kayitli, kayitliRole]]),
      fetch: vi.fn(async () => null),
    },
    members: { me: { roles: { highest: { position: botPosition } } } },
    channels: { cache: new Map(), fetch: vi.fn(async () => null) },
  };
}

function useRoleMap() {
  getRoleId.mockImplementation(async (_guildId, key) => ROLE_IDS[key] ?? null);
}

beforeEach(() => {
  clearFivemMemory();
  clearSanctionMemory();
  settingsStore.clear();
  getRoleId.mockReset();
  getRoleId.mockResolvedValue(null);
});

describe('kayitFlow/kayit durumu ve panel', () => {
  it('varsayilan acik; kapatilip acilabilir', async () => {
    expect(await getKayitState('g1')).toMatchObject({ open: true });
    await setKayitState('g1', false, 'u1');
    expect(await getKayitState('g1')).toMatchObject({ open: false, by: 'u1' });
  });

  it('acik panel kayit:sifirla ve kayit:et selectlerini tasir', () => {
    const payload = kayitInteractivePayload(t, { open: true });
    const json = JSON.stringify(payload);
    expect(json).toContain('kayit:et');
    expect(json).toContain('kayit:sifirla');
    expect(json).toContain('Açık');
  });

  it('kapali panelde select yok, kapali metni var', () => {
    const payload = kayitInteractivePayload(t, { open: false });
    const json = JSON.stringify(payload);
    expect(json).not.toContain('kayit:et');
    expect(json).toContain('Kapalı');
  });

  it('refreshKayitPanel gonderir, sonra duzenler', async () => {
    const guild = fakeGuild();
    const sentMessage = { id: 'panel-msg', edit: vi.fn(async () => {}) };
    const channel = {
      id: 'c-kayit',
      send: vi.fn(async () => sentMessage),
      messages: { fetch: vi.fn(async () => null) },
    };
    guild.channels.cache.set('c-kayit', channel);

    const first = await refreshKayitPanel(guild, t, { channelId: 'c-kayit' });
    expect(first).toMatchObject({ ok: true, posted: true });
    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(await getKayitPanel('g1')).toEqual({ channelId: 'c-kayit', messageId: 'panel-msg' });

    channel.messages.fetch.mockResolvedValue(sentMessage);
    const second = await refreshKayitPanel(guild, t, { open: false });
    expect(second).toMatchObject({ ok: true, updated: true });
    expect(sentMessage.edit).toHaveBeenCalledTimes(1);
    expect(channel.send).toHaveBeenCalledTimes(1);
  });

  it('kanal yoksa hata doner', async () => {
    const guild = fakeGuild();
    expect(await refreshKayitPanel(guild, t)).toEqual({ ok: false, error: 'kanal_yok' });
  });
});

describe('kayitFlow/registerMember', () => {
  it('basarili kayit: rol verir, kayitsiz alir, isim ve kayit yazar', async () => {
    useRoleMap();
    const guild = fakeGuild();
    const member = fakeMember({ roles: [ROLE_IDS.kayitsiz] });
    const actor = { id: 'a1' };

    const result = await registerMember(guild, { member, actor, actorTag: 'yetkili', icName: 'Ali Veli', oocName: 'ali' });
    expect(result).toEqual({ ok: true });
    expect(member.roles.add).toHaveBeenCalledWith(ROLE_IDS.kayitli, 'Kayit: a1');
    expect(member.roles.remove).toHaveBeenCalledWith(ROLE_IDS.kayitsiz, 'Kayit: a1');
    expect(member.setNickname).toHaveBeenCalledWith('Ali Veli', 'Kayit ismi');
    expect((await getByUser('g1', 'm1')).ic_name).toBe('Ali Veli');
  });

  it('blacklist rolu olan kayit edilemez', async () => {
    useRoleMap();
    const guild = fakeGuild();
    const member = fakeMember({ roles: [ROLE_IDS.blacklist] });

    expect(await registerMember(guild, { member, actor: { id: 'a1' }, icName: 'X' })).toEqual({ ok: false, error: 'blacklist' });
    expect(member.roles.add).not.toHaveBeenCalled();
  });

  it('mukerrer kayit reddedilir', async () => {
    useRoleMap();
    const guild = fakeGuild();
    const member = fakeMember();
    const actor = { id: 'a1' };

    await registerMember(guild, { member, actor, icName: 'Ali' });
    expect(await registerMember(guild, { member, actor, icName: 'Ali' })).toEqual({ ok: false, error: 'zaten_kayitli' });
  });

  it('hesap yasi yetersizse hata ve detay doner', async () => {
    useRoleMap();
    const guild = fakeGuild();
    const member = fakeMember({ accountDays: 2 });

    const result = await registerMember(guild, { member, actor: { id: 'a1' }, icName: 'X', minAccountDays: 10 });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('hesap_yeni');
    expect(result.detail).toContain('gün');
  });

  it('kayitli rolu ayarli degilse rol_yok', async () => {
    useRoleMap();
    const guild = fakeGuild();
    const member = fakeMember();
    getRoleId.mockImplementation(async (_guildId, key) => (key === 'kayitsiz' ? ROLE_IDS.kayitsiz : null));

    expect(await registerMember(guild, { member, actor: { id: 'a1' }, icName: 'X' })).toEqual({ ok: false, error: 'rol_yok' });
  });

  it('bot hiyerarsisi yetmezse bot_konum', async () => {
    useRoleMap();
    const guild = fakeGuild({ rolePosition: 60, botPosition: 10 });
    const member = fakeMember();

    expect(await registerMember(guild, { member, actor: { id: 'a1' }, icName: 'X' })).toEqual({ ok: false, error: 'bot_konum' });
  });
});

describe('kayitFlow/unregisterMember', () => {
  it('kayitliyi alir kayitsizi verir', async () => {
    useRoleMap();
    const guild = fakeGuild();
    const member = fakeMember({ roles: [ROLE_IDS.kayitli] });

    expect(await unregisterMember(guild, { member, actor: { id: 'a1' } })).toEqual({ ok: true });
    expect(member.roles.remove).toHaveBeenCalledWith(ROLE_IDS.kayitli, 'Kayitsiza atma: a1');
    expect(member.roles.add).toHaveBeenCalledWith(ROLE_IDS.kayitsiz, 'Kayitsiza atma: a1');
  });

  it('kayitli rolu botun ustundeyse bot_konum', async () => {
    useRoleMap();
    const guild = fakeGuild({ rolePosition: 60, botPosition: 10 });
    const member = fakeMember({ roles: [ROLE_IDS.kayitli] });

    expect(await unregisterMember(guild, { member, actor: { id: 'a1' } })).toEqual({ ok: false, error: 'bot_konum' });
  });
});
