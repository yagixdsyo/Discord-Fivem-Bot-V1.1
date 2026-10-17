/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../../db/index.js';
import { makeCaseId } from './util.js';

const CAPS = { punishments: 2000, warnings: 3000, appeals: 500, roleLogs: 3000 };

const MEM = {
  punishments: [],
  warnings: [],
  appeals: [],
  roleLogs: [],
};

function nowIso() {
  return new Date().toISOString();
}

function capPush(list, doc, cap) {
  list.unshift(doc);
  if (list.length > cap) list.length = cap;
  return doc;
}

function byCreatedDesc(a, b) {
  return String(b.created_at).localeCompare(String(a.created_at));
}

/** Test izolasyonu. */
export function clearModerationMemory() {
  MEM.punishments.length = 0;
  MEM.warnings.length = 0;
  MEM.appeals.length = 0;
  MEM.roleLogs.length = 0;
}

// ---------------------------------------------------------------------------
// Cezalar (punishments)
// ---------------------------------------------------------------------------

/**
 * @param {{guildId: string, userId: string, type: 'ban'|'mute'|'kick'|'whitelist'|'uyari'|'unban'|'unmute'|'unwhitelist', reason?: string|null, actorId?: string|null, actorTag?: string|null, userName?: string|null, durationMs?: number|null, permanent?: boolean, source?: string, meta?: object|null}} input
 */
export async function addPunishment({
  guildId,
  userId,
  type,
  reason = null,
  actorId = null,
  actorTag = null,
  userName = null,
  durationMs = null,
  permanent = false,
  source = 'komut',
  active = true,
  meta = null,
}) {
  const doc = {
    case_id: makeCaseId(),
    guild_id: guildId,
    user_id: userId,
    user_name: userName,
    type,
    reason,
    actor_id: actorId,
    actor_tag: actorTag,
    permanent: Boolean(permanent),
    duration_ms: durationMs ?? null,
    expires_at: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
    active: Boolean(active),
    source,
    meta,
    created_at: nowIso(),
    lifted_at: null,
    lifted_by: null,
    lift_reason: null,
  };

  if (isDbReady()) {
    await getCollection('punishments').insertOne({ ...doc });
  } else {
    capPush(MEM.punishments, doc, CAPS.punishments);
  }
  return doc;
}

export async function getPunishmentByCase(guildId, caseId) {
  if (isDbReady()) {
    return getCollection('punishments').findOne({ guild_id: guildId, case_id: caseId });
  }
  return MEM.punishments.find((doc) => doc.guild_id === guildId && doc.case_id === caseId) ?? null;
}

/** @returns {Promise<object[]>} en yeni ilk */
export async function listPunishments(guildId, { userId = null, type = null, active = null, limit = 50, skip = 0 } = {}) {
  const filter = { guild_id: guildId };
  if (userId) filter.user_id = userId;
  if (type) filter.type = type;
  if (active !== null) filter.active = Boolean(active);

  if (isDbReady()) {
    return getCollection('punishments')
      .find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  return MEM.punishments
    .filter((doc) => {
      if (doc.guild_id !== guildId) return false;
      if (userId && doc.user_id !== userId) return false;
      if (type && doc.type !== type) return false;
      if (active !== null && Boolean(doc.active) !== Boolean(active)) return false;
      return true;
    })
    .sort(byCreatedDesc)
    .slice(skip, skip + limit);
}

export async function countPunishments(guildId, { userId = null, type = null, active = null } = {}) {
  const filter = { guild_id: guildId };
  if (userId) filter.user_id = userId;
  if (type) filter.type = type;
  if (active !== null) filter.active = Boolean(active);

  if (isDbReady()) {
    return getCollection('punishments').countDocuments(filter);
  }
  const all = await listPunishments(guildId, { userId, type, active, limit: 10_000 });
  return all.length;
}

/** Aktif ceza turleri bazinda sayim (bilgi kartlari icin). */
export async function activeStats(guildId) {
  const types = ['ban', 'mute', 'whitelist'];
  const out = { ban: 0, mute: 0, whitelist: 0, toplam: 0 };
  for (const type of types) {
    out[type] = await countPunishments(guildId, { type, active: true });
    out.toplam += out[type];
  }
  return out;
}

/** Aktif cezayi kaldirir (case id ile). */
export async function liftPunishment(guildId, caseId, { actorId = null, reason = null } = {}) {
  const patch = { active: false, lifted_at: nowIso(), lifted_by: actorId, lift_reason: reason };
  if (isDbReady()) {
    const result = await getCollection('punishments').findOneAndUpdate(
      { guild_id: guildId, case_id: caseId, active: true },
      { $set: patch },
    );
    const doc = result?.value ?? result;
    return doc ? { ok: true, doc } : { ok: false, error: 'ceza_yok' };
  }
  const doc = MEM.punishments.find((item) => item.guild_id === guildId && item.case_id === caseId && item.active);
  if (!doc) return { ok: false, error: 'ceza_yok' };
  Object.assign(doc, patch);
  return { ok: true, doc };
}

/** Bir kullanicinin tur verilen aktif cezalarini kaldirir. */
export async function liftActivePunishments(guildId, { userId, types, actorId = null, reason = null, permanent = null }) {
  const active = (await listPunishments(guildId, { userId, active: true, limit: 200 }))
    .filter((doc) => types.includes(doc.type))
    .filter((doc) => (permanent === null ? true : Boolean(doc.permanent) === Boolean(permanent)));

  const lifted = [];
  for (const doc of active) {
    const result = await liftPunishment(guildId, doc.case_id, { actorId, reason });
    if (result.ok) lifted.push(result.doc);
  }
  return { lifted: lifted.length, cases: lifted };
}

/** Aktif banlar (perma dahil) - /banaffı ve ban kacagi kontrolu icin. */
export async function listActiveBans(guildId) {
  return listPunishments(guildId, { type: 'ban', active: true, limit: 1000 });
}

/** Kullanicinin tum aktif cezalari. */
export async function findActiveByUser(guildId, userId) {
  return listPunishments(guildId, { userId, active: true, limit: 100 });
}

// ---------------------------------------------------------------------------
// Uyarilar (warnings)
// ---------------------------------------------------------------------------

const WARN_DECAY_MS = 7 * 86_400_000;

/**
 * @param {{guildId: string, userId: string, type?: 'genel'|'etkinlik'|'arac', reason?: string|null, actorId?: string|null, actorTag?: string|null}} input
 */
export async function addWarning({ guildId, userId, type = 'genel', reason = null, actorId = null, actorTag = null }) {
  const doc = {
    warning_id: makeCaseId(),
    guild_id: guildId,
    user_id: userId,
    type,
    reason,
    actor_id: actorId,
    actor_tag: actorTag,
    active: true,
    created_at: nowIso(),
    next_decay_at: new Date(Date.now() + WARN_DECAY_MS).toISOString(),
    removed_at: null,
    removed_by: null,
  };
  if (isDbReady()) {
    await getCollection('warnings').insertOne({ ...doc });
  } else {
    capPush(MEM.warnings, doc, CAPS.warnings);
  }
  return doc;
}

export async function listWarnings(guildId, { userId = null, type = null, active = null, limit = 50, skip = 0 } = {}) {
  const filter = { guild_id: guildId };
  if (userId) filter.user_id = userId;
  if (type) filter.type = type;
  if (active !== null) filter.active = Boolean(active);

  if (isDbReady()) {
    return getCollection('warnings')
      .find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }
  return MEM.warnings
    .filter((doc) => {
      if (doc.guild_id !== guildId) return false;
      if (userId && doc.user_id !== userId) return false;
      if (type && doc.type !== type) return false;
      if (active !== null && Boolean(doc.active) !== Boolean(active)) return false;
      return true;
    })
    .sort(byCreatedDesc)
    .slice(skip, skip + limit);
}

export async function countActiveWarnings(guildId, userId, type = null) {
  const filter = { guild_id: guildId, user_id: userId, active: true };
  if (type) filter.type = type;
  if (isDbReady()) {
    return getCollection('warnings').countDocuments(filter);
  }
  return MEM.warnings.filter((doc) => {
    if (doc.guild_id !== guildId || doc.user_id !== userId || !doc.active) return false;
    if (type && doc.type !== type) return false;
    return true;
  }).length;
}

export async function getWarning(guildId, warningId) {
  if (isDbReady()) {
    return getCollection('warnings').findOne({ guild_id: guildId, warning_id: warningId });
  }
  return MEM.warnings.find((doc) => doc.guild_id === guildId && doc.warning_id === warningId) ?? null;
}

export async function removeWarning(guildId, warningId, { actorId = null, reason = null } = {}) {
  const patch = { active: false, removed_at: nowIso(), removed_by: actorId, remove_reason: reason };
  if (isDbReady()) {
    const result = await getCollection('warnings').findOneAndUpdate(
      { guild_id: guildId, warning_id: warningId, active: true },
      { $set: patch },
    );
    const doc = result?.value ?? result;
    return doc ? { ok: true, doc } : { ok: false, error: 'uyari_yok' };
  }
  const doc = MEM.warnings.find((item) => item.guild_id === guildId && item.warning_id === warningId && item.active);
  if (!doc) return { ok: false, error: 'uyari_yok' };
  Object.assign(doc, patch);
  return { ok: true, doc };
}

/** Kullanicinin en eski aktif uyarilarindan n tanesini kaldirir (/uyarı azalt). */
export async function reduceOldestWarnings(guildId, userId, count = 1, { actorId = null } = {}) {
  const active = (await listWarnings(guildId, { userId, active: true, limit: 200 }))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  const removed = [];
  for (const doc of active.slice(0, Math.max(0, count))) {
    const result = await removeWarning(guildId, doc.warning_id, { actorId, reason: 'Manuel azaltma' });
    if (result.ok) removed.push(result.doc);
  }
  return removed;
}

/** Kullanicinin tum aktif uyarilarini kaldirir (/uyarı sıfırla). */
export async function resetWarnings(guildId, userId, { actorId = null } = {}) {
  const active = await listWarnings(guildId, { userId, active: true, limit: 500 });
  let removed = 0;
  for (const doc of active) {
    const result = await removeWarning(guildId, doc.warning_id, { actorId, reason: 'Sıfırlama' });
    if (result.ok) removed += 1;
  }
  return removed;
}

async function setWarningNextDecay(guildId, warningId, iso) {
  if (isDbReady()) {
    await getCollection('warnings').updateOne({ guild_id: guildId, warning_id: warningId }, { $set: { next_decay_at: iso } });
    return;
  }
  const doc = MEM.warnings.find((item) => item.guild_id === guildId && item.warning_id === warningId);
  if (doc) doc.next_decay_at = iso;
}

/**
 * Haftalik azalma: suresi gelen uyarilardan her kullanici icin en eskisini kaldirir;
 * yeni en eskisinin sonraki azalma tarihini bir hafta ileri alir.
 */
export async function decayDueWarnings(guildId, now = new Date()) {
  const nowIsoStr = now.toISOString();
  let candidates;
  if (isDbReady()) {
    candidates = await getCollection('warnings')
      .find({ guild_id: guildId, active: true, next_decay_at: { $lte: nowIsoStr } })
      .sort({ created_at: 1 })
      .limit(500)
      .toArray();
  } else {
    candidates = MEM.warnings
      .filter((doc) => doc.guild_id === guildId && doc.active && doc.next_decay_at && doc.next_decay_at <= nowIsoStr)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }

  const byUser = new Map();
  for (const doc of candidates) {
    const list = byUser.get(doc.user_id) ?? [];
    list.push(doc);
    byUser.set(doc.user_id, list);
  }

  const decayed = [];
  for (const [, list] of byUser) {
    const oldest = list[0];
    const result = await removeWarning(guildId, oldest.warning_id, { reason: 'Haftalık otomatik azalma' });
    if (result.ok) decayed.push(result.doc);
    const next = list[1];
    if (next) await setWarningNextDecay(guildId, next.warning_id, new Date(now.getTime() + WARN_DECAY_MS).toISOString());
  }
  return { decayed, users: byUser.size };
}

// ---------------------------------------------------------------------------
// Ban itirazlari (ban_appeals)
// ---------------------------------------------------------------------------

export async function createAppeal({ guildId, userId, userName = null, banCase = null, reason, evidence = null }) {
  const doc = {
    appeal_id: makeCaseId(),
    guild_id: guildId,
    user_id: userId,
    user_name: userName,
    ban_case: banCase,
    reason,
    evidence,
    status: 'beklemede',
    created_at: nowIso(),
    decided_by: null,
    decided_at: null,
    decision_note: null,
  };
  if (isDbReady()) {
    await getCollection('ban_appeals').insertOne({ ...doc });
  } else {
    capPush(MEM.appeals, doc, CAPS.appeals);
  }
  return doc;
}

export async function listAppeals(guildId, { status = null, limit = 20 } = {}) {
  const filter = { guild_id: guildId };
  if (status) filter.status = status;
  if (isDbReady()) {
    return getCollection('ban_appeals').find(filter).sort({ created_at: -1 }).limit(limit).toArray();
  }
  return MEM.appeals
    .filter((doc) => doc.guild_id === guildId && (!status || doc.status === status))
    .sort(byCreatedDesc)
    .slice(0, limit);
}

export async function getAppeal(guildId, appealId) {
  if (isDbReady()) {
    return getCollection('ban_appeals').findOne({ guild_id: guildId, appeal_id: appealId });
  }
  return MEM.appeals.find((doc) => doc.guild_id === guildId && doc.appeal_id === appealId) ?? null;
}

export async function decideAppeal(guildId, appealId, { status, by = null, note = null }) {
  const patch = { status, decided_by: by, decided_at: nowIso(), decision_note: note };
  if (isDbReady()) {
    const result = await getCollection('ban_appeals').findOneAndUpdate(
      { guild_id: guildId, appeal_id: appealId, status: 'beklemede' },
      { $set: patch },
    );
    const doc = result?.value ?? result;
    return doc ? { ok: true, doc } : { ok: false, error: 'itiraz_yok' };
  }
  const doc = MEM.appeals.find((item) => item.guild_id === guildId && item.appeal_id === appealId && item.status === 'beklemede');
  if (!doc) return { ok: false, error: 'itiraz_yok' };
  Object.assign(doc, patch);
  return { ok: true, doc };
}

// ---------------------------------------------------------------------------
// Rol loglari (role_logs)
// ---------------------------------------------------------------------------

/**
 * @param {{guildId: string, userId: string, roleId: string, action: 'ekle'|'cikar', actorId?: string|null, actorTag?: string|null, via?: string}} input
 */
export async function addRoleLog({ guildId, userId, roleId, action, actorId = null, actorTag = null, via = 'komut' }) {
  const doc = {
    guild_id: guildId,
    user_id: userId,
    role_id: roleId,
    action,
    actor_id: actorId,
    actor_tag: actorTag,
    via,
    at: nowIso(),
  };
  if (isDbReady()) {
    await getCollection('role_logs').insertOne({ ...doc });
  } else {
    capPush(MEM.roleLogs, doc, CAPS.roleLogs);
  }
  return doc;
}

export async function listRoleLogs(guildId, { userId = null, roleId = null, limit = 25 } = {}) {
  const filter = { guild_id: guildId };
  if (userId) filter.user_id = userId;
  if (roleId) filter.role_id = roleId;
  if (isDbReady()) {
    return getCollection('role_logs').find(filter).sort({ at: -1 }).limit(limit).toArray();
  }
  return MEM.roleLogs
    .filter((doc) => {
      if (doc.guild_id !== guildId) return false;
      if (userId && doc.user_id !== userId) return false;
      if (roleId && doc.role_id !== roleId) return false;
      return true;
    })
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, limit);
}
