/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { insertDoc, findDocs, findOneDoc, updateDoc } from '../../fivem/lib/store.js';


const CASES = 'sanctions';
const APPEALS = 'sanction_appeals';

export async function createSanction(payload) {
  const caseId = `ceza-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const doc = { case_id: caseId, status: 'aktif', created_at: new Date().toISOString(), appeals: [], ...payload };
  await insertDoc(CASES, doc);
  return caseId;
}

export async function getSanction(guildId, caseId) {
  return findOneDoc(CASES, { guild_id: guildId, case_id: caseId });
}

export async function listSanctions(guildId, { userId = null, type = null, limit = 50 } = {}) {
  const filter = { guild_id: guildId };
  if (userId) filter.user_id = userId;
  if (type) filter.type = type;
  return findDocs(CASES, filter, { sort: { created_at: -1 }, limit });
}

export async function updateStatus(guildId, caseId, status) {
  await updateDoc(CASES, { guild_id: guildId, case_id: caseId }, { status, updated_at: new Date().toISOString() });
  return true;
}

export async function finalizeUnban(caseId, guildId) {
  try {
    const doc = guildId ? await getSanction(guildId, caseId) : null;
    if (!doc || doc.type !== 'ban' || doc.status !== 'aktif') return;
    if (doc.user_id) {
      // unban will be done in Discord command/process context; here status update only
    }
    await updateStatus(doc.guild_id, caseId, 'suresi_bitti');
  } catch {}
}

export async function createAppeal({ guildId, caseId, userId, reason }) {
  const appealId = `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,4)}`;
  const doc = { appeal_id: appealId, guild_id: guildId, case_id: caseId, user_id: userId, reason, status: 'beklemede', created_at: new Date().toISOString() };
  await insertDoc(APPEALS, doc);
  await updateDoc(CASES, { guild_id: guildId, case_id: caseId }, { status: 'itiraz_beklemede' });
  return appealId;
}

export async function getAppeal(guildId, appealId) {
  return findOneDoc(APPEALS, { guild_id: guildId, appeal_id: appealId });
}

export async function reviewAppeal({ guildId, appealId, reviewerId, approved, note }) {
  const appeal = await getAppeal(guildId, appealId);
  if (!appeal || appeal.status !== 'beklemede') return { ok: false };
  await updateDoc(APPEALS, { guild_id: guildId, appeal_id: appealId }, {
    status: approved ? 'onaylandi' : 'reddedildi',
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    note: note || null,
  });
  await updateDoc(CASES, { guild_id: guildId, case_id: appeal.case_id }, {
    status: approved ? 'iptal' : 'aktif',
    appeal_result: approved ? 'onaylandi' : 'reddedildi',
    appealed_by: reviewerId,
  });
  return { ok: true };
}

export async function listAppeals(guildId, { status = null, limit = 50 } = {}) {
  const filter = { guild_id: guildId };
  if (status) filter.status = status;
  return findDocs(APPEALS, filter, { sort: { created_at: -1 }, limit });
}

export async function staffStats(guildId, staffId = null) {
  const rows = await findDocs(CASES, { guild_id: guildId }, { limit: 1000 }).catch(() => []);
  const stats = new Map();
  for (const row of rows) {
    if (!row.issued_by) continue;
    if (staffId && row.issued_by !== staffId) continue;
    if (!stats.has(row.issued_by)) stats.set(row.issued_by, { warn:0, kick:0, ban:0, jail:0, total:0 });
    const item = stats.get(row.issued_by);
    item.total += 1;
    if (item[row.type] !== undefined) item[row.type] += 1;
  }
  return [...stats.entries()].map(([id, v]) => ({ staffId: id, ...v }));
}
