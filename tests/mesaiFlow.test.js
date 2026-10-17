/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { createTranslator } from '../src/locales/index.js';
import { clearFivemMemory } from '../src/modules/fivem/lib/store.js';
import {
  getPresenceConfig,
  runPresenceCheck,
  scanPresence,
  setPresenceConfig,
} from '../src/modules/fivem/lib/presenceCheck.js';
import { tickPresenceGuild } from '../src/modules/fivem/lib/presenceLoop.js';
import {
  endShift,
  getShiftConfig,
  setShiftConfig,
  startShift,
} from '../src/modules/shift/lib/shifts.js';

const t = createTranslator('tr');

const MESAI_ROLE = '910000000000000001';
const ILK_ROLE = '910000000000000002';
const LEGAL_ROLE = '910000000000000003';
const CHANNEL_ID = '920000000000000001';

function fakeMember(id = 'm1', roles = []) {
  const cache = new Map(roles.map((role) => [role, {}]));
  return {
    id,
    nickname: null,
    manageable: true,
    user: { id, username: `uye-${id}`, bot: false },
    roles: {
      cache,
      add: vi.fn(async (roleId) => {
        cache.set(roleId, {});
        return true;
      }),
      remove: vi.fn(async (roleId) => {
        cache.delete(roleId);
        return true;
      }),
    },
    setNickname: vi.fn(async () => {}),
  };
}

function fakeGuild({ members = [], channel = null, vanityURLCode = 'testsunucu' } = {}) {
  const map = new Map(members.map((member) => [member.id, member]));
  return {
    id: 'g1',
    name: 'Test Sunucu',
    vanityURLCode,
    members: { cache: map, fetch: vi.fn(async (id) => (id === undefined ? map : (map.get(id) ?? null))) },
    channels: {
      cache: new Map(channel ? [[channel.id, channel]] : []),
      fetch: vi.fn(async (id) => (channel && channel.id === id ? channel : null)),
    },
    roles: { cache: new Map(), fetch: vi.fn(async () => null) },
  };
}

function fakeChannel() {
  const sent = [];
  const channel = {
    id: CHANNEL_ID,
    send: vi.fn(async (payload) => {
      const message = { id: `msg-${sent.length + 1}`, payload, delete: vi.fn(async () => true) };
      sent.push(message);
      return message;
    }),
    messages: {
      fetch: vi.fn(async (id) => sent.find((message) => message.id === id) ?? null),
    },
  };
  return { channel, sent };
}

beforeEach(() => {
  clearFivemMemory();
  settingsStore.clear();
});

describe('sesli mesai rolleri', () => {
  it('ilk mesai girişinde mesai + ilk kayıt + legal rolleri verilir', async () => {
    await setShiftConfig('g1', {
      shiftRoleId: MESAI_ROLE,
      firstShiftRoleId: ILK_ROLE,
      legalRoleId: LEGAL_ROLE,
    });
    const member = fakeMember('m1');
    const guild = fakeGuild({ members: [member] });

    const result = await startShift({ guild, member });
    expect(result.ok).toBe(true);
    expect(member.roles.add).toHaveBeenCalledWith(MESAI_ROLE, 'Ilk mesai girisi');
    expect(member.roles.add).toHaveBeenCalledWith(ILK_ROLE, 'Ilk mesai girisi');
    expect(member.roles.add).toHaveBeenCalledWith(LEGAL_ROLE, 'Ilk mesai girisi');
    expect(result.doc.first_shift).toBe(true);
  });

  it('ikinci mesaide yalnızca mesai rolü verilir, ilk/legal tekrar verilmez', async () => {
    await setShiftConfig('g1', {
      shiftRoleId: MESAI_ROLE,
      firstShiftRoleId: ILK_ROLE,
      legalRoleId: LEGAL_ROLE,
    });
    const member = fakeMember('m1');
    const guild = fakeGuild({ members: [member] });

    await startShift({ guild, member });
    await endShift({ guild, userId: 'm1', reason: 'test' });
    member.roles.add.mockClear();

    await startShift({ guild, member });
    const added = member.roles.add.mock.calls.map((call) => call[0]);
    expect(added).toEqual([MESAI_ROLE]);
  });

  it('çıkışta mesai rolü alınır, ilk/legal roller kalır', async () => {
    await setShiftConfig('g1', {
      shiftRoleId: MESAI_ROLE,
      firstShiftRoleId: ILK_ROLE,
      legalRoleId: LEGAL_ROLE,
    });
    const member = fakeMember('m1');
    const guild = fakeGuild({ members: [member] });

    await startShift({ guild, member });
    await endShift({ guild, userId: 'm1', reason: 'test' });

    const removed = member.roles.remove.mock.calls.map((call) => call[0]);
    expect(removed).toContain(MESAI_ROLE);
    expect(removed).not.toContain(ILK_ROLE);
    expect(member.roles.cache.has(ILK_ROLE)).toBe(true);
  });

  it('zaten sahip olunan roller tekrar eklenmez', async () => {
    await setShiftConfig('g1', { shiftRoleId: MESAI_ROLE });
    const member = fakeMember('m1', [MESAI_ROLE]);
    const guild = fakeGuild({ members: [member] });

    await startShift({ guild, member });
    expect(member.roles.add).not.toHaveBeenCalled();
  });

  it('/mesai-rol argümansız ayarları gösterir', async () => {
    await setShiftConfig('g1', { shiftRoleId: MESAI_ROLE });
    const mod = await import('../src/modules/shift/commands/mesai-rol.js');
    const replies = [];
    const ctx = {
      t,
      args: {},
      user: { id: 'yonetici', username: 'yonetici' },
      guild: { id: 'g1', name: 'Test Sunucu', members: { me: { roles: { highest: { position: 100 } } } } },
      reply: async (payload) => replies.push(payload),
      followUp: async (payload) => replies.push(payload),
    };
    await mod.default.run(ctx);
    const json = JSON.stringify(replies[0]);
    expect(json).toContain('Mesai Rol Ayarlar');
    expect(json).toContain(MESAI_ROLE);
  });

  it('/mesai-rol rol kaydeder', async () => {
    const mod = await import('../src/modules/shift/commands/mesai-rol.js');
    const replies = [];
    const ctx = {
      t,
      args: { mesai: { id: MESAI_ROLE, position: 10 }, legal: { id: LEGAL_ROLE, position: 11 } },
      user: { id: 'yonetici', username: 'yonetici' },
      guild: { id: 'g1', name: 'Test Sunucu', members: { me: { roles: { highest: { position: 100 } } } } },
      reply: async (payload) => replies.push(payload),
      followUp: async (payload) => replies.push(payload),
    };
    await mod.default.run(ctx);
    const config = await getShiftConfig('g1');
    expect(config.shiftRoleId).toBe(MESAI_ROLE);
    expect(config.legalRoleId).toBe(LEGAL_ROLE);
    expect(JSON.stringify(replies[0])).toContain('Mesai Rolleri Güncellendi');
  });
});

describe('durum otomatik kontrolü', () => {
  function statusMember(id, state) {
    const member = fakeMember(id);
    member.presence = state === null ? null : { activities: [{ type: 4, state }] };
    return member;
  }

  it('ayar varsayılanları ve sınırlama', async () => {
    const defaults = await getPresenceConfig('g1');
    expect(defaults).toMatchObject({ enabled: false, intervalMinutes: 60, pingMembers: true });

    await setPresenceConfig('g1', { intervalMinutes: 1 });
    expect((await getPresenceConfig('g1')).intervalMinutes).toBe(5);
    await setPresenceConfig('g1', { intervalMinutes: 5000 });
    expect((await getPresenceConfig('g1')).intervalMinutes).toBe(1440);
  });

  it('tarama eksik ve çevrimdışı üyeleri ayırır', async () => {
    const ok = statusMember('ok1', 'test sunucu davet');
    const missing = statusMember('miss1', 'merhaba');
    const offline = statusMember('off1', null);
    const bot = statusMember('bot1', 'merhaba');
    bot.user.bot = true;
    const guild = fakeGuild({ members: [ok, missing, offline, bot] });

    const scan = await scanPresence(guild, { config: { ...(await getPresenceConfig('g1')) } });
    expect(scan.checked).toBe(2);
    expect(scan.missing).toEqual(['miss1']);
    expect(scan.offline).toEqual(['off1']);
  });

  it('ek kelimeler durumu geçerli kılar', async () => {
    const member = statusMember('k1', 'besm fivem oynuyorum');
    const guild = fakeGuild({ members: [member] });
    const scan = await scanPresence(guild, {
      config: { ...(await getPresenceConfig('g1')), keywords: ['besm'] },
    });
    expect(scan.missing).toEqual([]);
  });

  it('kontrol mesajı gönderir, ikinci turda eski mesajı siler', async () => {
    const { channel, sent } = fakeChannel();
    const member = statusMember('miss1', 'merhaba');
    const guild = fakeGuild({ members: [member], channel });
    await setPresenceConfig('g1', {
      enabled: true,
      channelId: CHANNEL_ID,
      intervalMinutes: 5,
      keywords: [],
    });

    const first = await runPresenceCheck(guild, { t, force: true });
    expect(first.ok).toBe(true);
    expect(first.missing).toEqual(['miss1']);
    expect(sent).toHaveLength(1);

    const config = await getPresenceConfig('g1');
    expect(config.messageId).toBe('msg-1');
    expect(config.lastRunAt).toBeTruthy();

    const second = await runPresenceCheck(guild, { t, force: true });
    expect(second.ok).toBe(true);
    expect(sent).toHaveLength(2);
    expect(sent[0].delete).toHaveBeenCalled();
  });

  it('aralık dolmadan tekrar çalışmaz', async () => {
    const { channel } = fakeChannel();
    const guild = fakeGuild({ members: [], channel });
    await setPresenceConfig('g1', { enabled: true, channelId: CHANNEL_ID, intervalMinutes: 60, messageId: null });
    await setPresenceConfig('g1', { lastRunAt: new Date().toISOString() });

    const result = await runPresenceCheck(guild, { t });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('bekliyor');
  });

  it('kapalı sistemde loop kontrol yapmaz, açıkken yapar', async () => {
    const { channel } = fakeChannel();
    const guild = fakeGuild({ members: [], channel });

    const off = await tickPresenceGuild(guild, { t });
    expect(off.skipped).toBe(true);

    await setPresenceConfig('g1', { enabled: true, channelId: CHANNEL_ID });
    const on = await tickPresenceGuild(guild, { t });
    expect(on.ok).toBe(true);
  });

  it('/durum-otomatik açılınca kanal şartı ve ilk tarama yapılır', async () => {
    const { channel, sent } = fakeChannel();
    const mod = await import('../src/modules/fivem/commands/durumotomatik.js');
    const replies = [];
    const ctx = {
      t,
      db: { ready: true },
      args: { durum: 'ac' },
      user: { id: 'yonetici', username: 'yonetici' },
      guild: fakeGuild({ members: [statusMember('miss1', 'selam')], channel }),
      reply: async (payload) => replies.push(payload),
      followUp: async (payload) => replies.push(payload),
    };

    // Kanal yokken kaydedilir ama uyarı verilir.
    await mod.default.run(ctx);
    expect(JSON.stringify(replies[0])).toContain('kanal seçilmedi');

    // Kanal eklenip açılınca ilk tarama hemen yapılır.
    replies.length = 0;
    ctx.args = { durum: 'ac', kanal: { id: CHANNEL_ID, isTextBased: () => true } };
    await mod.default.run(ctx);
    const config = await getPresenceConfig('g1');
    expect(config.enabled).toBe(true);
    expect(config.channelId).toBe(CHANNEL_ID);
    expect(sent.length).toBe(1);
    expect(JSON.stringify(replies[0])).toContain('İlk tarama');
  });
});
