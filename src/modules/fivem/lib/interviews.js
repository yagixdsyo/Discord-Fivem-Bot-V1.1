/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { findDocs, findOneDoc, insertDoc, updateDoc } from './store.js';

const COL = 'interviews';

export const INTERVIEW_STATUS = ['beklemede', 'odada', 'gecti', 'kaldi', 'ertelendi', 'iptal'];

export async function inviteToInterview({ guildId, userId, userTag = null, invitedBy }) {
  const doc = {
    interview_id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    guild_id: guildId,
    user_id: userId,
    user_tag: userTag,
    invited_by: invitedBy,
    status: 'beklemede',
    room_id: null,
    decided_by: null,
    decided_at: null,
    note: null,
  };
  await insertDoc(COL, doc);
  return doc;
}

export async function getInterview(guildId, interviewId) {
  return findOneDoc(COL, { guild_id: guildId, interview_id: interviewId });
}

export async function getActiveByUser(guildId, userId) {
  const rows = await findDocs(COL, { guild_id: guildId, user_id: userId }, { sort: { created_at: -1 }, limit: 5 });
  return rows.find((doc) => ['beklemede', 'odada'].includes(doc.status)) ?? null;
}

export async function listInterviews(guildId, { status = null, limit = 20 } = {}) {
  const filter = { guild_id: guildId };
  if (status) filter.status = status;
  return findDocs(COL, filter, { sort: { created_at: -1 }, limit });
}

export async function setRoom(guildId, interviewId, roomId) {
  return updateDoc(COL, { guild_id: guildId, interview_id: interviewId }, { room_id: roomId, status: 'odada' });
}

/**
 * DM on soru-cevap yanitlarini kayda isler.
 * @returns {{ok: boolean, doc?: object, error?: string}}
 */
export async function recordDmAnswers(guildId, interviewId, { answers, by = null }) {
  const doc = await getInterview(guildId, interviewId);
  if (!doc) return { ok: false, error: 'mulakat_yok' };
  const clean = (answers ?? []).filter((a) => a?.soru && a?.cevap);
  await updateDoc(COL, { guild_id: guildId, interview_id: interviewId }, {
    dm_answers: clean,
    dm_answered_at: new Date().toISOString(),
    dm_answered_by: by,
  });
  return { ok: true, doc: { ...doc, dm_answers: clean } };
}

export async function decideInterview(guildId, interviewId, { status, by, note = null }) {
  const doc = await getInterview(guildId, interviewId);
  if (!doc) return { ok: false, error: 'mulakat_yok' };
  if (['gecti', 'kaldi', 'iptal'].includes(doc.status)) return { ok: false, error: 'zaten_karar' };

  await updateDoc(
    COL,
    { guild_id: guildId, interview_id: interviewId },
    { status, decided_by: by, decided_at: new Date().toISOString(), note },
  );
  return { ok: true, doc: { ...doc, status, decided_by: by, note } };
}

export async function cancelInterview(guildId, interviewId, { by }) {
  return decideInterview(guildId, interviewId, { status: 'iptal', by, note: null });
}
