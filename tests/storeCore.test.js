/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  addPunishment,
  listPunishments,
  countPunishments,
  liftPunishment,
  liftActivePunishments,
  findActiveByUser,
  addWarning,
  listWarnings,
  countActiveWarnings,
  getWarning,
  removeWarning,
  reduceOldestWarnings,
  resetWarnings,
  decayDueWarnings,
  createAppeal,
  getAppeal,
  listAppeals,
  decideAppeal,
  addRoleLog,
  listRoleLogs,
  clearModerationMemory,
} from '../src/modules/moderation/lib/store.js';

const G = 'g1';
const U = 'u1';

beforeEach(() => {
  clearModerationMemory();
});

describe('store/punishments', () => {
  it('ceza ekler ve listeler (en yeni ilk)', async () => {
    const a = await addPunishment({ guildId: G, userId: U, type: 'mute', durationMs: 60_000 });
    const b = await addPunishment({ guildId: G, userId: U, type: 'ban' });
    const list = await listPunishments(G, { userId: U, active: null, limit: 10 });
    expect(list).toHaveLength(2);
    expect(list[0].case_id).toBe(b.case_id);
    expect(list[1].case_id).toBe(a.case_id);
    expect(a.expires_at).toBeTruthy();
    expect(b.expires_at).toBeNull();
  });

  it('liftPunishment aktif cezayi kapatir, ikinci kez kapatamaz', async () => {
    const doc = await addPunishment({ guildId: G, userId: U, type: 'ban' });
    const first = await liftPunishment(G, doc.case_id, { actorId: 'a1', reason: 'test' });
    expect(first.ok).toBe(true);
    expect(first.doc.active).toBe(false);
    expect(first.doc.lifted_by).toBe('a1');

    const second = await liftPunishment(G, doc.case_id, {});
    expect(second.ok).toBe(false);
    expect(second.error).toBe('ceza_yok');
  });

  it('liftActivePunishments permanent filtresiyle calisir', async () => {
    await addPunishment({ guildId: G, userId: U, type: 'ban', permanent: false });
    await addPunishment({ guildId: G, userId: U, type: 'ban', permanent: true });

    const normal = await liftActivePunishments(G, { userId: U, types: ['ban'], permanent: false });
    expect(normal.lifted).toBe(1);

    const active = await findActiveByUser(G, U);
    expect(active).toHaveLength(1);
    expect(active[0].permanent).toBe(true);

    const perma = await liftActivePunishments(G, { userId: U, types: ['ban'], permanent: true });
    expect(perma.lifted).toBe(1);
    expect(await findActiveByUser(G, U)).toHaveLength(0);
  });

  it('kick kaydi active:false tutulur', async () => {
    await addPunishment({ guildId: G, userId: U, type: 'kick', active: false });
    expect(await countPunishments(G, { type: 'kick', active: true })).toBe(0);
    expect(await countPunishments(G, { type: 'kick', active: null })).toBe(1);
  });
});

describe('store/warnings', () => {
  it('uyari ekler, sayar, siler', async () => {
    const w1 = await addWarning({ guildId: G, userId: U, reason: 'spam' });
    await addWarning({ guildId: G, userId: U, type: 'etkinlik' });

    expect(await countActiveWarnings(G, U)).toBe(2);
    expect(await countActiveWarnings(G, U, 'etkinlik')).toBe(1);

    const fetched = await getWarning(G, w1.warning_id);
    expect(fetched.reason).toBe('spam');

    const removed = await removeWarning(G, w1.warning_id, { actorId: 'a1', reason: 'manuel' });
    expect(removed.ok).toBe(true);
    expect(await countActiveWarnings(G, U)).toBe(1);

    const again = await removeWarning(G, w1.warning_id, {});
    expect(again.ok).toBe(false);
  });

  it('reduceOldestWarnings en eskiden azaltir', async () => {
    const first = await addWarning({ guildId: G, userId: U, reason: 'ilk' });
    await new Promise((r) => setTimeout(r, 5));
    await addWarning({ guildId: G, userId: U, reason: 'ikinci' });

    const removed = await reduceOldestWarnings(G, U, 1, { actorId: 'a1' });
    expect(removed).toHaveLength(1);
    expect(removed[0].warning_id).toBe(first.warning_id);
    expect(await countActiveWarnings(G, U)).toBe(1);
  });

  it('resetWarnings tum aktif uyarilari kaldirir', async () => {
    await addWarning({ guildId: G, userId: U });
    await addWarning({ guildId: G, userId: U });
    expect(await resetWarnings(G, U, { actorId: 'a1' })).toBe(2);
    expect(await countActiveWarnings(G, U)).toBe(0);
  });

  it('decayDueWarnings her kullanici icin en eskisini dusurur ve sonrakini one alir', async () => {
    const w1 = await addWarning({ guildId: G, userId: U, reason: 'eski' });
    const w2 = await addWarning({ guildId: G, userId: U, reason: 'yeni' });
    // Ikisinin de azalma tarihini gecmise cek
    const past = new Date(Date.now() - 1000).toISOString();
    for (const w of await listWarnings(G, { userId: U, active: true })) w.next_decay_at = past;
    // Ayni ms'te olusmus olabilirler; "en eski" siralamasini kesinlestir
    const first = await getWarning(G, w1.warning_id);
    first.created_at = new Date(Date.now() - 60_000).toISOString();
    const second = await getWarning(G, w2.warning_id);
    second.created_at = new Date(Date.now() - 30_000).toISOString();

    const result = await decayDueWarnings(G, new Date());
    expect(result.users).toBe(1);
    expect(result.decayed).toHaveLength(1);
    expect(result.decayed[0].warning_id).toBe(w1.warning_id);

    const remaining = await listWarnings(G, { userId: U, active: true });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].warning_id).toBe(w2.warning_id);
    expect(new Date(remaining[0].next_decay_at).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('store/appeals', () => {
  it('itiraz olusturur ve karara baglar (tek sefer)', async () => {
    const appeal = await createAppeal({ guildId: G, userId: U, reason: 'yanlis ban', banCase: 'c-1' });
    expect(appeal.status).toBe('beklemede');

    expect(await listAppeals(G, { status: 'beklemede' })).toHaveLength(1);

    const decided = await decideAppeal(G, appeal.appeal_id, { status: 'onaylandi', by: 'a1' });
    expect(decided.ok).toBe(true);
    expect(decided.doc.decided_by).toBe('a1');

    const again = await decideAppeal(G, appeal.appeal_id, { status: 'reddedildi', by: 'a2' });
    expect(again.ok).toBe(false);

    const fetched = await getAppeal(G, appeal.appeal_id);
    expect(fetched.status).toBe('onaylandi');
  });
});

describe('store/roleLogs', () => {
  it('rol logu ekler ve kullaniciya gore listeler', async () => {
    await addRoleLog({ guildId: G, userId: U, roleId: 'r1', action: 'ekle', actorId: 'a1' });
    await addRoleLog({ guildId: G, userId: 'u2', roleId: 'r1', action: 'cikar', actorId: 'a1' });

    const logs = await listRoleLogs(G, { userId: U });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('ekle');
    expect(logs[0].via).toBe('komut');
  });
});
