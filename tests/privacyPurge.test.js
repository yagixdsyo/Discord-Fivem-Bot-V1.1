/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { clearFivemMemory, findDocs, insertDoc } from '../src/modules/fivem/lib/store.js';
import { clearSnipeMemory, getSnipes, pushSnipe } from '../src/modules/moderation/lib/snipe.js';
import { purgeGuildData } from '../src/modules/core/lib/privacy.js';

const G = 'g1';
const guild = { id: G, channels: { cache: new Map() } };

beforeEach(() => {
  clearFivemMemory();
  clearSnipeMemory();
});

describe('veri silme', () => {
  it('dmlog ve bekleme kayitlarini yalnizca ilgili sunucudan siler', async () => {
    await insertDoc('dm_logs', { guild_id: G, job_id: 'j1', kind: 'kayit' });
    await insertDoc('dm_logs', { guild_id: 'g2', job_id: 'j2', kind: 'kayit' });
    await insertDoc('support_waits', { guild_id: G, user_id: 'u1' });
    await insertDoc('support_records', { guild_id: G, user_id: 'u1' });
    await insertDoc('complaints', { guild_id: G, complaint_id: 'c1' });
    await insertDoc('feedback', { guild_id: G, officer_id: 'o1' });

    const counts = await purgeGuildData(guild, { types: ['dmlog', 'bekleme'] });
    expect(counts.dmlog).toBe(1);
    expect(counts.bekleme).toBe(4);
    expect((await findDocs('dm_logs', { guild_id: G })).length).toBe(0);
    expect((await findDocs('dm_logs', { guild_id: 'g2' })).length).toBe(1);
    expect((await findDocs('support_waits', { guild_id: G })).length).toBe(0);
  });

  it('snipe onbellegini temizler ve diger turleri korur', async () => {
    await pushSnipe('c1', { kind: 'silme', authorId: 'u1', content: 'gizli icerik' });
    await insertDoc('dm_logs', { guild_id: G, job_id: 'j3', kind: 'kayit' });
    expect((await getSnipes('c1')).length).toBe(1);

    const counts = await purgeGuildData(guild, { types: ['snipe'] });
    expect(counts.snipe).toBeGreaterThanOrEqual(1);
    expect((await getSnipes('c1')).length).toBe(0);
    // snipe disi turler korunur
    expect((await findDocs('dm_logs', { guild_id: G })).length).toBe(1);
  });
});
