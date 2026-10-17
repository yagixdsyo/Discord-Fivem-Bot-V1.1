/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { findDocs, findOneDoc, insertDoc, updateDoc } from './store.js';

const COMPLAINTS = 'complaints';
const FEEDBACK = 'feedback';

export const COMPLAINT_STATUS = ['beklemede', 'inceleniyor', 'sonuclandi', 'reddedildi'];

export async function createComplaint({ guildId, userId, userTag = null, target, reason, evidence = null }) {
  const doc = {
    complaint_id: `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    guild_id: guildId,
    user_id: userId,
    user_tag: userTag,
    target: String(target ?? '').slice(0, 200),
    reason: String(reason ?? '').slice(0, 1500),
    evidence: evidence ? String(evidence).slice(0, 500) : null,
    status: 'beklemede',
    decided_by: null,
  };
  await insertDoc(COMPLAINTS, doc);
  return doc;
}

export async function getComplaint(guildId, complaintId) {
  return findOneDoc(COMPLAINTS, { guild_id: guildId, complaint_id: complaintId });
}

export async function setComplaintStatus(guildId, complaintId, status, by) {
  const doc = await getComplaint(guildId, complaintId);
  if (!doc) return { ok: false, error: 'sikayet_yok' };
  await updateDoc(
    COMPLAINTS,
    { guild_id: guildId, complaint_id: complaintId },
    { status, decided_by: by, decided_at: new Date().toISOString() },
  );
  return { ok: true, doc: { ...doc, status, decided_by: by } };
}

export async function listComplaints(guildId, { status = null, limit = 20 } = {}) {
  const filter = { guild_id: guildId };
  if (status) filter.status = status;
  return findDocs(COMPLAINTS, filter, { sort: { created_at: -1 }, limit });
}

// ---------------------------------------------------------------------------
// Yetkili feedback
// ---------------------------------------------------------------------------

export async function addFeedback({ guildId, userId, userTag = null, officerId, officerTag = null, score, comment = null }) {
  const doc = {
    guild_id: guildId,
    user_id: userId,
    user_tag: userTag,
    officer_id: officerId,
    officer_tag: officerTag,
    score: Math.max(1, Math.min(5, Number(score) || 1)),
    comment: comment ? String(comment).slice(0, 500) : null,
  };
  await insertDoc(FEEDBACK, doc);
  return doc;
}

export async function officerFeedbackStats(guildId, officerId, { limit = 500 } = {}) {
  const rows = await findDocs(FEEDBACK, { guild_id: guildId, officer_id: officerId }, { sort: { created_at: -1 }, limit });
  const total = rows.length;
  const sum = rows.reduce((acc, row) => acc + (Number(row.score) || 0), 0);
  return { total, average: total > 0 ? Math.round((sum / total) * 100) / 100 : 0, rows };
}
