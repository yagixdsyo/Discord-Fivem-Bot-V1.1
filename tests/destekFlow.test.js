/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { clearFivemMemory } from '../src/modules/fivem/lib/store.js';
import {
  WAIT_COOLDOWN_MS,
  addSupportRecord,
  claimWait,
  closeWait,
  getSupportRecord,
  listSupportRecords,
  listWaits,
  registerWait,
  supportStats,
} from '../src/modules/fivem/lib/support.js';
import {
  cancelInterview,
  decideInterview,
  getActiveByUser,
  getInterview,
  inviteToInterview,
  listInterviews,
  setRoom,
} from '../src/modules/fivem/lib/interviews.js';
import {
  addFeedback,
  createComplaint,
  getComplaint,
  listComplaints,
  officerFeedbackStats,
  setComplaintStatus,
} from '../src/modules/fivem/lib/complaints.js';

beforeEach(() => {
  clearFivemMemory();
});

describe('destek/bekleme kaydi', () => {
  it('ilk kayit spam degil, 15 dk icindeki tekrar spam olur', async () => {
    const first = await registerWait({ guildId: 'g1', userId: 'u1', userTag: 'oyuncu', channelId: 'v1' });
    expect(first.spam).toBe(false);
    expect(first.doc.claimed_by).toBe(null);

    const second = await registerWait({ guildId: 'g1', userId: 'u1', userTag: 'oyuncu', channelId: 'v1' });
    expect(second.spam).toBe(true);

    expect(WAIT_COOLDOWN_MS).toBe(15 * 60_000);
  });

  it('sahiplenme: ayni yetkili tekrar sahiplenebilir, baskasi sahiplenemez', async () => {
    await registerWait({ guildId: 'g1', userId: 'u1', channelId: 'v1' });

    expect(await claimWait('g1', 'u1', 'y1')).toBe(true);
    expect(await claimWait('g1', 'u1', 'y1')).toBe(true);
    expect(await claimWait('g1', 'u1', 'y2')).toBe(false);
    expect(await claimWait('g1', 'yok', 'y1')).toBe(false);
  });

  it('kapatilan bekleme listeden duser', async () => {
    await registerWait({ guildId: 'g1', userId: 'u1', channelId: 'v1' });
    expect(await listWaits('g1')).toHaveLength(1);

    expect(await closeWait('g1', 'u1')).toBe(true);
    expect(await listWaits('g1')).toHaveLength(0);
    expect(await closeWait('g1', 'yok')).toBe(false);
  });
});

describe('destek/kayitlari ve istatistik', () => {
  it('dakika 0-1440 araligina kirpilir', async () => {
    const high = await addSupportRecord({ guildId: 'g1', actorId: 'y1', userId: 'u1', kind: 'kayit', minutes: 9999 });
    const low = await addSupportRecord({ guildId: 'g1', actorId: 'y1', userId: 'u2', kind: 'destek', minutes: -5 });

    expect(high.minutes).toBe(1440);
    expect(low.minutes).toBe(0);
    expect(high.record_id).toMatch(/^s-/);

    expect(await getSupportRecord('g1', high.record_id)).toMatchObject({ actor_id: 'y1' });
  });

  it('liste yetkili/kullanici filtreleri ve istatistik toplami calisir', async () => {
    await addSupportRecord({ guildId: 'g1', actorId: 'y1', userId: 'u1', kind: 'kayit', minutes: 30 });
    await addSupportRecord({ guildId: 'g1', actorId: 'y1', userId: 'u2', kind: 'destek', minutes: 10 });
    await addSupportRecord({ guildId: 'g1', actorId: 'y2', userId: 'u1', kind: 'genel', minutes: 5 });

    expect(await listSupportRecords('g1', { actorId: 'y1' })).toHaveLength(2);
    expect(await listSupportRecords('g1', { userId: 'u1' })).toHaveLength(2);

    const stats = await supportStats('g1', { days: 30 });
    expect(stats[0]).toEqual({ actor_id: 'y1', adet: 2, dakika: 40 });
    expect(stats[1]).toEqual({ actor_id: 'y2', adet: 1, dakika: 5 });
  });
});

describe('mulakat akisi', () => {
  it('davet -> oda -> karar dongusu', async () => {
    const doc = await inviteToInterview({ guildId: 'g1', userId: 'u1', invitedBy: 'y1' });
    expect(doc.status).toBe('beklemede');
    expect((await getActiveByUser('g1', 'u1')).interview_id).toBe(doc.interview_id);

    expect(await setRoom('g1', doc.interview_id, 'room-1')).toBe(true);
    expect(await getInterview('g1', doc.interview_id)).toMatchObject({ status: 'odada', room_id: 'room-1' });

    const decided = await decideInterview('g1', doc.interview_id, { status: 'gecti', by: 'y1' });
    expect(decided.ok).toBe(true);
    expect(decided.doc.status).toBe('gecti');
    expect(await getActiveByUser('g1', 'u1')).toBe(null);
  });

  it('kararli mulakat yeniden karara baglanamaz, iptal de karar sayilir', async () => {
    const doc = await inviteToInterview({ guildId: 'g1', userId: 'u2', invitedBy: 'y1' });
    const cancelled = await cancelInterview('g1', doc.interview_id, { by: 'y1' });
    expect(cancelled.ok).toBe(true);
    expect(cancelled.doc.status).toBe('iptal');

    expect(await decideInterview('g1', doc.interview_id, { status: 'gecti', by: 'y1' })).toEqual({ ok: false, error: 'zaten_karar' });
    expect(await decideInterview('g1', 'yok', { status: 'gecti', by: 'y1' })).toEqual({ ok: false, error: 'mulakat_yok' });
  });

  it('liste durum filtresi uygular', async () => {
    const a = await inviteToInterview({ guildId: 'g1', userId: 'u1', invitedBy: 'y1' });
    await inviteToInterview({ guildId: 'g1', userId: 'u2', invitedBy: 'y1' });
    await decideInterview('g1', a.interview_id, { status: 'kaldi', by: 'y1' });

    expect(await listInterviews('g1')).toHaveLength(2);
    expect(await listInterviews('g1', { status: 'kaldi' })).toHaveLength(1);
  });
});

describe('sikayet ve feedback', () => {
  it('sikayet olusturur, durum gunceller', async () => {
    const doc = await createComplaint({ guildId: 'g1', userId: 'u1', target: 'hedef#1', reason: 'kufur', evidence: 'https://x' });
    expect(doc.complaint_id).toMatch(/^sc-/);
    expect(doc.status).toBe('beklemede');

    const updated = await setComplaintStatus('g1', doc.complaint_id, 'inceleniyor', 'y1');
    expect(updated.ok).toBe(true);
    expect((await getComplaint('g1', doc.complaint_id)).decided_by).toBe('y1');

    expect(await listComplaints('g1', { status: 'inceleniyor' })).toHaveLength(1);
    expect(await setComplaintStatus('g1', 'yok', 'sonuclandi', 'y1')).toEqual({ ok: false, error: 'sikayet_yok' });
  });

  it('feedback puani 1-5 araligina kirpilir, ortalama yuvarlanir', async () => {
    await addFeedback({ guildId: 'g1', userId: 'u1', officerId: 'y1', score: 9, comment: 'iyi' });
    await addFeedback({ guildId: 'g1', userId: 'u2', officerId: 'y1', score: 0 });

    const stats = await officerFeedbackStats('g1', 'y1');
    expect(stats.total).toBe(2);
    expect(stats.average).toBe(3); // (5 + 1) / 2
    expect(stats.rows[0].comment === 'iyi' || stats.rows[1].comment === 'iyi').toBe(true);
  });
});
