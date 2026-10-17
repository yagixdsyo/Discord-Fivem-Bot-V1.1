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

vi.mock('../src/ui/emoji.js', () => ({
  emoji: (key) => `«${key}»`,
  emojiObj: () => undefined,
}));

import { createTranslator } from '../src/locales/index.js';
import { clearFivemMemory } from '../src/modules/fivem/lib/store.js';
import { progressBar } from '../src/modules/terfi/lib/bar.js';
import {
  addStaffPoints,
  awardTicketPoints,
  buildLadder,
  computeRank,
  defaultConfig,
  getStaff,
  getStaffConfig,
  setStaffConfig,
  staffLeaderboard,
  syncStaffRank,
} from '../src/modules/terfi/lib/staff.js';

const t = createTranslator('tr');

const R1 = '111111111111111111';
const R2 = '222222222222222222';
const R3 = '333333333333333333';

function ladderConfig(extra = {}) {
  return { ...defaultConfig(), rankRoleIds: [R1, R2, R3], basePoints: 10, multiplier: 2, ...extra };
}

function fakeMember(id, roles = []) {
  const cache = new Map(roles.map((role) => [role, {}]));
  return {
    id,
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
    user: { username: `kullanici-${id}`, displayAvatarURL: () => null },
    displayName: `görünen-${id}`,
  };
}

function fakeGuild(members = [], { channel = null } = {}) {
  const map = new Map(members.map((member) => [member.id, member]));
  return {
    id: 'g1',
    name: 'Test Sunucu',
    members: { fetch: vi.fn(async (id) => map.get(id) ?? null), me: { roles: { highest: { position: 100 } } } },
    channels: {
      cache: new Map(channel ? [[channel.id, channel]] : []),
      fetch: vi.fn(async (id) => (channel && channel.id === id ? channel : null)),
    },
  };
}

beforeEach(() => {
  clearFivemMemory();
  settingsStore.clear();
});

describe('terfi merdiveni', () => {
  it('esikler her rutbede carpan kadar zorlasir', () => {
    const ladder = buildLadder(ladderConfig());
    expect(ladder.map((row) => row.threshold)).toEqual([10, 20, 40]);
    expect(ladder[0].name).toBe('Yetkili Adayı');
    expect(ladder[1].roleId).toBe(R2);
  });

  it('computeRank puanin denk geldigi rutbeyi bulur', () => {
    const ladder = buildLadder(ladderConfig());
    expect(computeRank(0, ladder)).toMatchObject({ index: -1, current: null });
    expect(computeRank(0, ladder).next.roleId).toBe(R1);
    expect(computeRank(15, ladder).current.roleId).toBe(R1);
    expect(computeRank(15, ladder).next.roleId).toBe(R2);
    expect(computeRank(999, ladder).current.roleId).toBe(R3);
    expect(computeRank(999, ladder).next).toBe(null);
  });

  it('ayarlar kaydedilir ve okunur', async () => {
    await setStaffConfig('g1', { basePoints: 25, multiplier: 3, announceChannelId: '555555555555555555' });
    const config = await getStaffConfig('g1');
    expect(config.basePoints).toBe(25);
    expect(config.multiplier).toBe(3);
    expect(config.announceChannelId).toBe('555555555555555555');
  });
});

describe('terfi puan deposu', () => {
  it('puan eklenir, eksiltilir ve taban 0 korunur', async () => {
    await addStaffPoints('g1', 'm1', 5, { tickets: 1 });
    await addStaffPoints('g1', 'm1', 7, { tickets: 2 });
    let staff = await getStaff('g1', 'm1');
    expect(staff.points).toBe(12);
    expect(staff.tickets).toBe(3);

    await addStaffPoints('g1', 'm1', -50);
    staff = await getStaff('g1', 'm1');
    expect(staff.points).toBe(0);
  });

  it('leaderboard buyukten kucuge siralar', async () => {
    await addStaffPoints('g1', 'm1', 30);
    await addStaffPoints('g1', 'm2', 50);
    await addStaffPoints('g1', 'm3', 10);
    const rows = await staffLeaderboard('g1', { limit: 10 });
    expect(rows.map((row) => row.user_id)).toEqual(['m2', 'm1', 'm3']);
    expect(rows[0]).toMatchObject({ order: 1, points: 50 });
  });
});

describe('terfi senkronu', () => {
  it('esik asilinca rutbe rolu verilir, eski merdiven rolu alinir', async () => {
    await addStaffPoints('g1', 'm1', 25);
    const member = fakeMember('m1', [R1]);
    const guild = fakeGuild([member]);
    const res = await syncStaffRank({ guild, userId: 'm1', config: ladderConfig() });
    expect(res.ok).toBe(true);
    expect(res.promoted).toBe(true);
    expect(res.current.roleId).toBe(R2);
    expect(member.roles.add).toHaveBeenCalledWith(R2, 'Terfi (otomatik)');
    expect(member.roles.remove).toHaveBeenCalledWith(R1, 'Terfi (eski rutbe)');
  });

  it('zaten dogru rutbede olan uyede islem yapilmaz', async () => {
    await addStaffPoints('g1', 'm1', 25);
    const member = fakeMember('m1', [R2]);
    const guild = fakeGuild([member]);
    const res = await syncStaffRank({ guild, userId: 'm1', config: ladderConfig() });
    expect(res.promoted).toBe(false);
    expect(member.roles.add).not.toHaveBeenCalled();
  });

  it('uye bulunamazsa ok:false doner', async () => {
    await addStaffPoints('g1', 'yok', 99);
    const guild = fakeGuild([]);
    const res = await syncStaffRank({ guild, userId: 'yok', config: ladderConfig() });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('uye_yok');
  });
});

describe('ticket puani', () => {
  it('onu claim eden yetkili puan alir', async () => {
    const member = fakeMember('m1');
    const guild = fakeGuild([member]);
    const res = await awardTicketPoints({ guild, ticket: { user_id: 'u1', claimed_by: 'm1' }, by: 'm2', t });
    expect(res.staffId).toBe('m1');
    expect(res.delta).toBe(1);
    expect((await getStaff('g1', 'm1')).points).toBe(1);
  });

  it('claim yoksa kapatan yetkili puan alir; sahibin kendi talebi sayilmaz', async () => {
    const member = fakeMember('m2');
    const guild = fakeGuild([member]);
    const res = await awardTicketPoints({ guild, ticket: { user_id: 'u1' }, by: 'm2', t });
    expect(res.staffId).toBe('m2');

    const none = await awardTicketPoints({ guild, ticket: { user_id: 'm2' }, by: 'm2', t });
    expect(none).toBe(null);
  });

  it('talep puani ayari delta olarak kullanilir', async () => {
    await setStaffConfig('g1', { pointsPerTicket: 5 });
    const guild = fakeGuild([fakeMember('m1')]);
    const res = await awardTicketPoints({ guild, ticket: { user_id: 'u1', claimed_by: 'm1' }, by: 'm2', t });
    expect(res.delta).toBe(5);
  });

  it('terfi duyuru kanali kayitliysa canvas duyurusu gonderilir', async () => {
    const member = fakeMember('m1');
    const sends = [];
    const channel = { id: '777777777777777777', send: vi.fn(async (payload) => sends.push(payload)) };
    await setStaffConfig('g1', { announceChannelId: channel.id, basePoints: 1, rankRoleIds: [R1] });
    const guild = fakeGuild([member], { channel });
    const res = await awardTicketPoints({ guild, ticket: { user_id: 'u1', claimed_by: 'm1' }, by: 'm2', t });
    expect(res.promoted).toBe(true);
    expect(res.announced).toBe(true);
    expect(sends).toHaveLength(1);
    expect(JSON.stringify(sends[0])).toContain('Terfi');
  });
});

describe('terfi bari', () => {
  it('baslangic/orta/son dolu-bos emojileri kullanilir', () => {
    const bar = progressBar(5, 10, { segments: 10 });
    expect(bar.startsWith('«BAR_BAS_DOLU»')).toBe(true);
    expect(bar.endsWith('«BAR_SON_BOS»')).toBe(true);
    expect(bar.split('«BAR_ORTA_DOLU»').length - 1).toBe(4);
    expect(bar.split('«BAR_ORTA_BOS»').length - 1).toBe(4);
  });

  it('tam dolulukta son parca da dolu olur; bos bar bos baslar', () => {
    const full = progressBar(10, 10, { segments: 10 });
    expect(full.startsWith('«BAR_BAS_DOLU»')).toBe(true);
    expect(full.endsWith('«BAR_SON_DOLU»')).toBe(true);

    const empty = progressBar(0, 10, { segments: 10 });
    expect(empty.startsWith('«BAR_BAS_BOS»')).toBe(true);
    expect(empty.endsWith('«BAR_SON_BOS»')).toBe(true);
  });
});

describe('terfi komutlari', () => {
  function makeCtx(args = {}, guild = fakeGuild([fakeMember('m1')])) {
    const replies = [];
    return {
      replies,
      ctx: {
        t,
        db: { ready: true },
        args,
        user: { id: 'yonetici', username: 'yonetici' },
        guild,
        reply: async (payload) => replies.push(payload),
        followUp: async (payload) => replies.push(payload),
      },
    };
  }

  it('/yetkili kartini gosterir', async () => {
    await setStaffConfig('g1', { rankRoleIds: [R1, R2], basePoints: 10, multiplier: 2 });
    await addStaffPoints('g1', 'm1', 15);
    const mod = await import('../src/modules/terfi/commands/yetkili.js');
    const { ctx, replies } = makeCtx({ kullanici: { id: 'm1', username: 'hedef' } });
    await mod.default.run(ctx);
    const json = JSON.stringify(replies[0]);
    expect(json).toContain('Yetkili Terfi Kart');
    expect(json).toContain('Rütbe');
    expect(json).toContain(R1);
  });

  it('/yetkili-ayar argumansiz mevcut ayari ve merdiveni gosterir', async () => {
    await setStaffConfig('g1', { rankRoleIds: [R1], basePoints: 10, multiplier: 2 });
    const mod = await import('../src/modules/terfi/commands/yetkili-ayar.js');
    const { ctx, replies } = makeCtx({});
    await mod.default.run(ctx);
    const json = JSON.stringify(replies[0]);
    expect(json).toContain('Terfi Ayarlar');
    expect(json).toContain('Terfi merdiveni');
    expect(json).toContain(R1);
  });

  it('/yetkili-puan puan ekler ve terfi verir', async () => {
    await setStaffConfig('g1', { rankRoleIds: [R1], basePoints: 10, multiplier: 2 });
    const member = fakeMember('m1');
    const guild = fakeGuild([member]);
    const mod = await import('../src/modules/terfi/commands/yetkili-puan.js');
    const { ctx, replies } = makeCtx({ kullanici: { id: 'm1', username: 'hedef' }, puan: 12 }, guild);
    await mod.default.run(ctx);
    expect((await getStaff('g1', 'm1')).points).toBe(12);
    expect(member.roles.add).toHaveBeenCalledWith(R1, 'Terfi (otomatik)');
    expect(JSON.stringify(replies[0])).toContain('Yetkili Puan');
  });
});
