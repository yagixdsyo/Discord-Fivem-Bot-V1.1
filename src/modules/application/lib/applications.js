/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { insertDoc, findDocs, findOneDoc, updateDoc } from '../../fivem/lib/store.js';
import { getSetting, setSetting } from '../../fivem/lib/state.js';

const APPS = 'applications';
const DRAFTS = 'application_drafts';

export const APPLICATION_TYPES = {
  yetkili: {
    title: 'Yetkili Başvurusu',
    questions: ['Ad Soyad', 'Yaş', 'Oyunda geçirdiğin süre', 'Ekip/rol geçmişi', 'Neden sen?'],
  },
  whitelist: {
    title: 'Whitelist Başvurusu',
    questions: ['Ad Soyad', 'Discord ID', 'RP deneyimi', 'RP senaryo', 'Kuralları okudun mu?'],
  },
  legal_ekip: {
    title: 'Legal Ekip Başvurusu',
    questions: ['Ad Soyad', 'Legal meslek', 'Ekip geçmişi', 'Oyunda geçirdiğin süre', 'Neden bu ekip?'],
  },
  illegal_ekip: {
    title: 'Illegal Ekip Başvurusu',
    questions: ['Ad Soyad', 'Faaliyet alanı', 'Bağlı illegal ekip geçmişi', 'Oyunda geçirdiğin süre', 'Neden bu ekip?'],
  },
};

export function getApplicationTypes() { return APPLICATION_TYPES; }

export async function createApplication({ guildId, userId, type, answers }) {
  const appId = `ap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,4)}`;
  const banned = await isBlacklisted(guildId, userId);
  const doc = { application_id: appId, guild_id: guildId, user_id: userId, type, answers: answers || [], status: banned ? 'yasakli' : 'beklemede', created_at: new Date().toISOString(), reviewed_by: null, reviewed_at: null, review_reason: null, auto_role: null };
  await insertDoc(APPS, doc);
  return doc;
}

export async function getApplication(guildId, appId) {
  return findOneDoc(APPS, { guild_id: guildId, application_id: appId });
}

export async function listApplications(guildId, { type = null, status = null, limit = 50 } = {}) {
  const filter = { guild_id: guildId };
  if (type) filter.type = type;
  if (status) filter.status = status;
  return findDocs(APPS, filter, { sort: { created_at: -1 }, limit });
}

export async function reviewApplication({ guildId, appId, reviewerId, status, reason = null }) {
  const doc = await getApplication(guildId, appId);
  if (!doc || doc.status === status) return false;
  await updateDoc(APPS, { guild_id: guildId, application_id: appId }, { status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), review_reason: reason || null });
  return true;
}

export async function setApplicationAutoRole(guildId, type, roleId) {
  const cur = (await getSetting(guildId, 'application.roles')) ?? {};
  cur[type] = roleId;
  await setSetting(guildId, 'application.roles', cur);
  return cur;
}

export async function getApplicationRoles(guildId) {
  return (await getSetting(guildId, 'application.roles')) ?? {};
}

export async function updateApplicationAutoRole(appId, roleId) { const { updateDoc } = await import('../../fivem/lib/store.js'); await updateDoc('applications', { application_id: appId }, { auto_role: roleId ?? null }); return true; }

export function buildQuestions(type) {
  return (APPLICATION_TYPES[type]?.questions ?? []).map((q, i) => ({ name: `q${i + 1}`, label: q.slice(0, 45), required: true }));
}

export async function saveDraft({ guildId, userId, type, answers }) {
  const existing = await findOneDoc(DRAFTS, { guild_id: guildId, user_id: userId, type, status: 'taslak' });
  if (existing) {
    await updateDoc(DRAFTS, { guild_id: guildId, user_id: userId, type, status: 'taslak' }, { answers: answers || existing.answers, updated_at: new Date().toISOString() });
    return existing.draft_id;
  }
  const draftId = `dr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,4)}`;
  await insertDoc(DRAFTS, { draft_id: draftId, guild_id: guildId, user_id: userId, type, answers: answers || [], status: 'taslak', created_at: new Date().toISOString() });
  return draftId;
}

export async function getDraft(guildId, userId, type) {
  return findOneDoc(DRAFTS, { guild_id: guildId, user_id: userId, type, status: 'taslak' });
}

export async function markDraftDone(guildId, draftId) {
  await updateDoc(DRAFTS, { guild_id: guildId, draft_id: draftId }, { status: 'gonderildi' });
  return true;
}

export async function hasCooldown(guildId, userId, type) {
  const rows = await listApplications(guildId, { type, limit: 50 });
  const last = rows.find((r) => r.user_id === userId && (r.status === 'beklemede' || r.status === 'yasakli' || r.status === 'onaylandi' || r.status === 'reddedildi' || r.status === 'mulakat'));
  if (!last) return false;
  const created = new Date(last.created_at).getTime();
  const waitDays = 3;
  return (Date.now() - created) < waitDays * 24 * 60 * 60 * 1000;
}

export async function isBlacklisted(guildId, userId) {
  const { isBlacklistedUser } = await import('../../blacklist/lib/blacklist.js');
  return isBlacklistedUser(guildId, userId).catch(() => false);
}
