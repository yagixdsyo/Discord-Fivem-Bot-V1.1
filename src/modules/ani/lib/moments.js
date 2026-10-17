/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { insertDoc, findDocs, findOneDoc, updateDoc } from '../../fivem/lib/store.js';

const MOMENTS = 'memory_moments';
const CONFIG = 'memory_config';

export async function createMoment({ guildId, title, content, tags = [], link = null, proposedBy }) {
  const now = new Date();
  const doc = {
    moment_id: `ani-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`,
    guild_id: guildId,
    title,
    content,
    tags: Array.isArray(tags) ? tags : [],
    link,
    proposed_by: proposedBy,
    status: 'beklemede',
    approved_by: null,
    approved_at: null,
    reject_reason: null,
    month_key: now.toISOString().slice(0, 7),
    created_at: now.toISOString(),
  };
  await insertDoc(MOMENTS, doc);
  return doc;
}

export async function getMoment(guildId, momentId) {
  return findOneDoc(MOMENTS, { guild_id: guildId, moment_id: momentId }).catch(() => null);
}

export async function listMoments(guildId, { status = 'onaylandi', limit = 200 } = {}) {
  const filter = { guild_id: guildId };
  if (status) filter.status = status;
  return findDocs(MOMENTS, filter, { sort: { approved_at: -1, created_at: -1 }, limit });
}

export async function pendingMoments(guildId, limit = 20) {
  return findDocs(MOMENTS, { guild_id: guildId, status: 'beklemede' }, { sort: { created_at: 1 }, limit });
}

export async function reviewMoment({ guildId, momentId, reviewerId, approved, reason = null }) {
  const doc = await getMoment(guildId, momentId);
  if (!doc) return { ok: false, error: 'missing' };
  if (doc.status !== 'beklemede') return { ok: false, error: 'already_reviewed' };
  await updateDoc(MOMENTS, { guild_id: guildId, moment_id: momentId }, {
    status: approved ? 'onaylandi' : 'reddedildi',
    approved_by: reviewerId,
    approved_at: approved ? new Date().toISOString() : null,
    reject_reason: approved ? null : reason,
  });
  return { ok: true, moment: { ...doc, status: approved ? 'onaylandi' : 'reddedildi' } };
}

export async function searchMoments(guildId, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return [];
  const rows = await listMoments(guildId, { status: 'onaylandi', limit: 500 });
  return rows
    .filter((m) => [m.title, m.content, ...(m.tags ?? [])].some((part) => String(part ?? '').toLowerCase().includes(needle)))
    .slice(0, 25);
}

export async function monthlyReport(guildId, monthKey) {
  const rows = (await listMoments(guildId, { status: 'onaylandi', limit: 1000 })).filter((m) => m.month_key === monthKey);
  return buildReport(rows);
}

export async function yearlyReport(guildId, year) {
  const prefix = String(year);
  const rows = (await listMoments(guildId, { status: 'onaylandi', limit: 1000 })).filter((m) => String(m.month_key ?? '').startsWith(prefix));
  return buildReport(rows);
}

function buildReport(rows) {
  const tags = new Map();
  const contributors = new Set();
  for (const row of rows) {
    contributors.add(row.proposed_by);
    for (const tag of row.tags ?? []) tags.set(tag, (tags.get(tag) ?? 0) + 1);
  }
  const topTags = [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { count: rows.length, contributorCount: contributors.size, topTags, rows };
}

export async function getConfig(guildId) {
  const doc = await findOneDoc(CONFIG, { guild_id: guildId }).catch(() => null);
  return { archiveChannelId: null, reviewChannelId: null, ...(doc?.config ?? {}) };
}

export async function setConfig(guildId, patch) {
  const current = await getConfig(guildId);
  const next = { ...current, ...patch };
  const existing = await findOneDoc(CONFIG, { guild_id: guildId }).catch(() => null);
  if (existing) await updateDoc(CONFIG, { guild_id: guildId }, { config: next, updated_at: new Date().toISOString() });
  else await insertDoc(CONFIG, { guild_id: guildId, config: next, created_at: new Date().toISOString() });
  return next;
}
