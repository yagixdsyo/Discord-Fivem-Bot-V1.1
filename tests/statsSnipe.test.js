/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  addMessage,
  flushStats,
  getUserDaily,
  getServerDaily,
  topUsers,
  clearStatsMemory,
} from '../src/modules/moderation/lib/stats.js';
import { pushSnipe, getSnipes, clearSnipeMemory } from '../src/modules/moderation/lib/snipe.js';
import { dayKey } from '../src/modules/moderation/lib/util.js';

const G = 'g1';
const U = 'u1';

beforeEach(() => {
  clearStatsMemory();
  clearSnipeMemory();
});

describe('stats/mesaj sayaci', () => {
  it('mesajlari tamponlar, flush edince gunluge yazar', async () => {
    addMessage(G, U);
    addMessage(G, U);
    addMessage(G, U);

    expect(await flushStats()).toBe(1);

    const rows = await getUserDaily(G, U, { days: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0].messages).toBe(3);
    expect(rows[0].day).toBe(dayKey());
    expect(rows[0].voice_seconds).toBe(0);
  });

  it('flush bos tamponda 0 doner', async () => {
    expect(await flushStats()).toBe(0);
  });

  it('gunluk ve sunucu toplamlari dogru okunur', async () => {
    addMessage(G, U);
    addMessage(G, U);
    addMessage(G, 'u2');
    await flushStats();

    const daily = await getServerDaily(G, { days: 1 });
    expect(daily).toHaveLength(1);
    expect(daily[0].messages).toBe(3);

    const top = await topUsers(G, { metric: 'messages', days: 1, limit: 5 });
    expect(top[0].user_id).toBe(U);
    expect(top[0].messages).toBe(2);
    expect(top[1].user_id).toBe('u2');
  });

  it('farkli sunucular karismaz', async () => {
    addMessage(G, U);
    addMessage('g2', U);
    await flushStats();

    expect(await getUserDaily(G, U, { days: 1 })).toHaveLength(1);
    expect(await getUserDaily('g2', U, { days: 1 })).toHaveLength(1);
    expect((await getServerDaily(G, { days: 1 }))[0].messages).toBe(1);
  });
});

describe('snipe/depo', () => {
  it('en yeni kayit ilk sirada doner', async () => {
    await pushSnipe('ch1', { kind: 'silme', authorId: U, content: 'ilk' });
    await pushSnipe('ch1', { kind: 'silme', authorId: U, content: 'ikinci' });

    const list = await getSnipes('ch1', { count: 10 });
    expect(list).toHaveLength(2);
    expect(list[0].content).toBe('ikinci');
    expect(list[0].kind).toBe('silme');
  });

  it('kanal basina 20 kayitla sinirlanir', async () => {
    for (let i = 1; i <= 25; i += 1) {
      await pushSnipe('ch2', { kind: 'silme', authorId: U, content: `m${i}` });
    }
    const list = await getSnipes('ch2', { count: 50 });
    expect(list).toHaveLength(20);
    expect(list[0].content).toBe('m25');
  });

  it('kind filtresi uygular', async () => {
    await pushSnipe('ch3', { kind: 'silme', authorId: U, content: 's1' });
    await pushSnipe('ch3', { kind: 'duzenleme', authorId: U, oldContent: 'a', newContent: 'b' });

    const edits = await getSnipes('ch3', { count: 10, kind: 'duzenleme' });
    expect(edits).toHaveLength(1);
    expect(edits[0].newContent).toBe('b');

    const empty = await getSnipes('ch4', { count: 5 });
    expect(empty).toEqual([]);
  });
});
