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

import {
  clearFivemMemory,
  countDocs,
  deleteDocs,
  findDocs,
  findOneDoc,
  insertDoc,
  updateDoc,
} from '../src/modules/fivem/lib/store.js';
import {
  actorCounters,
  addRegistration,
  countByActor,
  getByUser,
  isRegistered,
  listByActor,
  listByUser,
  resetByActor,
} from '../src/modules/fivem/lib/registration.js';
import {
  addReactionRole,
  canReact,
  clearReactionCooldown,
  emojiKeyOf,
  findReactionRole,
  listReactionRoles,
  removeReactionRole,
} from '../src/modules/fivem/lib/reactions.js';
import {
  closePoll,
  createPoll,
  getPoll,
  getRules,
  listPolls,
  parseRules,
  pollResults,
  setRules,
  votePoll,
} from '../src/modules/fivem/lib/rules.js';

beforeEach(() => {
  clearFivemMemory();
  clearReactionCooldown();
  settingsStore.clear();
});

describe('fivem/store bellek modu', () => {
  it('ekle/oku/guncelle/sil/say dongusu', async () => {
    await insertDoc('test_col', { guild_id: 'g1', value: 1, tag: 'a' });
    await insertDoc('test_col', { guild_id: 'g1', value: 2, tag: 'b' });

    expect(await countDocs('test_col', { guild_id: 'g1' })).toBe(2);
    const one = await findOneDoc('test_col', { value: 2 });
    expect(one.tag).toBe('b');
    expect(one.created_at).toBeTypeOf('string');

    expect(await updateDoc('test_col', { value: 1 }, { tag: 'z' })).toBe(true);
    expect((await findOneDoc('test_col', { value: 1 })).tag).toBe('z');

    expect(await deleteDocs('test_col', { value: 2 })).toBe(1);
    expect(await countDocs('test_col', {})).toBe(1);
  });

  it('$ne / $in / $gte / $lte filtreleri ve sort/limit calisir', async () => {
    await insertDoc('f', { guild_id: 'g1', n: 1, kind: 'a' });
    await insertDoc('f', { guild_id: 'g1', n: 2, kind: 'b' });
    await insertDoc('f', { guild_id: 'g1', n: 3, kind: 'c' });

    expect((await findDocs('f', { n: { $ne: 2 } })).map((d) => d.n).sort()).toEqual([1, 3]);
    expect((await findDocs('f', { kind: { $in: ['a', 'c'] } })).map((d) => d.n).sort()).toEqual([1, 3]);
    expect((await findDocs('f', { n: { $gte: 2, $lte: 3 } })).map((d) => d.n).sort()).toEqual([2, 3]);
    expect((await findDocs('f', { guild_id: 'g1' }, { sort: { n: -1 }, limit: 2 })).map((d) => d.n)).toEqual([3, 2]);
    expect(await findDocs('f', { guild_id: 'yok' })).toEqual([]);
  });
});

describe('fivem/registration sayaclari', () => {
  it('kayit ekler, mukerrer kontrolu ve gecmis calisir', async () => {
    await addRegistration({ guildId: 'g1', userId: 'u1', actorId: 'a1', actorTag: 'yetkili', icName: 'Ali Veli', oocName: 'ali' });

    expect(await isRegistered('g1', 'u1')).toBe(true);
    expect(await isRegistered('g1', 'u2')).toBe(false);
    expect((await getByUser('g1', 'u1')).ic_name).toBe('Ali Veli');
    expect(await listByUser('g1', 'u1')).toHaveLength(1);
    expect(await listByActor('g1', 'a1')).toHaveLength(1);
    expect(await countByActor('g1', 'a1')).toBe(1);
  });

  it('actorCounters adede gore siralar, resetByActor siler', async () => {
    await addRegistration({ guildId: 'g1', userId: 'u1', actorId: 'a1', icName: 'A' });
    await addRegistration({ guildId: 'g1', userId: 'u2', actorId: 'a1', icName: 'B' });
    await addRegistration({ guildId: 'g1', userId: 'u3', actorId: 'a2', icName: 'C' });

    const counters = await actorCounters('g1');
    expect(counters[0]).toEqual({ actor_id: 'a1', adet: 2 });
    expect(counters[1]).toEqual({ actor_id: 'a2', adet: 1 });

    expect(await resetByActor('g1', 'a1')).toBe(2);
    expect(await countByActor('g1', 'a1')).toBe(0);
  });
});

describe('fivem/reactions tepki rolu', () => {
  it('ekleme tekrarini reddeder, kaldirma calisir', async () => {
    const first = await addReactionRole({ guildId: 'g1', channelId: 'c1', messageId: 'm1', emojiKey: 'id:111', roleId: 'r1' });
    expect(first.ok).toBe(true);

    const dup = await addReactionRole({ guildId: 'g1', channelId: 'c1', messageId: 'm1', emojiKey: 'id:111', roleId: 'r2' });
    expect(dup).toEqual({ ok: false, error: 'zaten_var' });

    expect(await findReactionRole('g1', 'm1', 'id:111')).toMatchObject({ role_id: 'r1', active: true });
    expect(await listReactionRoles('g1', { messageId: 'm1' })).toHaveLength(1);

    expect(await removeReactionRole('g1', { messageId: 'm1', emojiKey: 'id:111' })).toBe(true);
    expect(await listReactionRoles('g1')).toHaveLength(0);
  });

  it('emojiKeyOf ozel emoji id ve unicode ayirir', () => {
    expect(emojiKeyOf({ id: '999', name: 'x' })).toBe('id:999');
    expect(emojiKeyOf({ id: null, name: '✅' })).toBe('uni:✅');
    expect(emojiKeyOf(null)).toBe('uni:');
  });

  it('canReact spam korumasi uygular', () => {
    expect(canReact('g1', 'u1')).toBe(true);
    expect(canReact('g1', 'u1')).toBe(false);
    expect(canReact('g1', 'u2')).toBe(true);
    clearReactionCooldown();
    expect(canReact('g1', 'u1')).toBe(true);
  });
});

describe('fivem/rules kurallar', () => {
  it('baslik satirlarini sayfalara boler', () => {
    const pages = parseRules('# Genel\nMadde 1\nMadde 2\n# RP\nMadde 3');
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ title: 'Genel', lines: ['Madde 1', 'Madde 2'] });
    expect(pages[1]).toMatchObject({ title: 'RP', lines: ['Madde 3'] });
  });

  it('basligi olmayan metinde varsayilan sayfa uretir, bos metinde dizi donmez', () => {
    const pages = parseRules('tek satir');
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe('Kurallar');
    expect(parseRules('')).toEqual([]);
    expect(parseRules(null)).toEqual([]);
  });

  it('sayfa basina 15 satiri gecirmez', () => {
    const text = ['# Uzun', ...Array.from({ length: 20 }, (_, i) => `satir ${i}`)].join('\n');
    const pages = parseRules(text);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0].lines).toHaveLength(15);
  });

  it('setRules/getRules ayar uzerinden saklar', async () => {
    const pages = [{ title: 'Genel', lines: ['Madde 1'] }];
    expect(await setRules('g1', pages)).toBe(true);
    expect(await getRules('g1')).toEqual(pages);
    expect(await getRules('g2')).toEqual([]);
  });
});

describe('fivem/rules oylama', () => {
  async function seedPoll({ multi = false } = {}) {
    return createPoll({ guildId: 'g1', question: 'Hangi harita?', options: ['A', 'B', 'C'], multi, ownerId: 'o1' });
  }

  it('tekli oy tekrar tiklayinca geri alinir', async () => {
    const poll = await seedPoll();
    const first = await votePoll('g1', poll.poll_id, 'u1', [0]);
    expect(first.myVotes).toEqual([0]);

    const again = await votePoll('g1', poll.poll_id, 'u1', [0]);
    expect(again.myVotes).toEqual([]);

    const moved = await votePoll('g1', poll.poll_id, 'u1', [2]);
    expect(moved.myVotes).toEqual([2]);
  });

  it('coklu oyda secim kumesi yazilir ve gecersiz index filtrelenir', async () => {
    const poll = await seedPoll({ multi: true });
    const first = await votePoll('g1', poll.poll_id, 'u1', [0, 2, 99]);
    expect(first.myVotes).toEqual([0, 2]);

    const second = await votePoll('g1', poll.poll_id, 'u1', [1]);
    expect(second.myVotes).toEqual([1]);
  });

  it('kapatilan oylamaya oy verilemez', async () => {
    const poll = await seedPoll();
    await closePoll('g1', poll.poll_id, { by: 'o1' });
    expect(await votePoll('g1', poll.poll_id, 'u1', [0])).toEqual({ ok: false, error: 'kapali' });
    expect((await listPolls('g1', { status: 'kapali' }))[0].poll_id).toBe(poll.poll_id);
  });

  it('pollResults yuzde ve cubuk uretir', async () => {
    const poll = await seedPoll();
    await votePoll('g1', poll.poll_id, 'u1', [0]);
    await votePoll('g1', poll.poll_id, 'u2', [0]);
    await votePoll('g1', poll.poll_id, 'u3', [1]);

    const results = pollResults(await getPoll('g1', poll.poll_id));
    expect(results[0]).toMatchObject({ index: 0, count: 2, percent: 67 });
    expect(results[1]).toMatchObject({ count: 1, percent: 33 });
    expect(results[0].bar).toHaveLength(10);
    expect(results[0].bar.startsWith('▰')).toBe(true);
  });
});
