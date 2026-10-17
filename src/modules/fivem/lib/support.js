/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { findDocs, findOneDoc, insertDoc, updateDoc } from './store.js';

const WAITS = 'support_waits';
const RECORDS = 'support_records';

export const WAIT_COOLDOWN_MS = 15 * 60_000;

/**
 * Bekleme kaydini olusturur/gunceller.
 * @returns {{doc: object, spam: boolean}} spam=true ise cagiran tarafa sakinlestirici mesaj gosterilir.
 */
export async function registerWait({ guildId, userId, userTag = null, channelId = null }) {
  const existing = await findOneDoc(WAITS, { guild_id: guildId, user_id: userId });
  const now = Date.now();
  const spam = Boolean(existing?.last_at && now - Date.parse(existing.last_at) < WAIT_COOLDOWN_MS);

  if (existing) {
    await updateDoc(
      WAITS,
      { guild_id: guildId, user_id: userId },
      { last_at: new Date(now).toISOString(), user_tag: userTag, channel_id: channelId, claimed_by: null },
    );
    return { doc: { ...existing, last_at: new Date(now).toISOString(), claimed_by: null }, spam };
  }

  const doc = {
    guild_id: guildId,
    user_id: userId,
    user_tag: userTag,
    channel_id: channelId,
    last_at: new Date(now).toISOString(),
    claimed_by: null,
  };
  await insertDoc(WAITS, doc);
  return { doc, spam: false };
}

export async function claimWait(guildId, userId, byId) {
  const doc = await findOneDoc(WAITS, { guild_id: guildId, user_id: userId });
  if (!doc) return false;
  if (doc.claimed_by && doc.claimed_by !== byId) return false;
  await updateDoc(WAITS, { guild_id: guildId, user_id: userId }, { claimed_by: byId, claimed_at: new Date().toISOString() });
  return true;
}

export async function closeWait(guildId, userId) {
  const doc = await findOneDoc(WAITS, { guild_id: guildId, user_id: userId });
  if (!doc) return false;
  await updateDoc(WAITS, { guild_id: guildId, user_id: userId }, { closed_at: new Date().toISOString() });
  return true;
}

export async function listWaits(guildId, { limit = 25 } = {}) {
  const rows = await findDocs(WAITS, { guild_id: guildId }, { sort: { last_at: -1 }, limit });
  return rows.filter((doc) => !doc.closed_at);
}

// ---------------------------------------------------------------------------
// Destek kayitlari (/destek-verdim)
// ---------------------------------------------------------------------------

export async function addSupportRecord({
  guildId,
  actorId,
  actorTag = null,
  userId,
  userTag = null,
  kind = 'genel',
  minutes = 0,
  note = null,
}) {
  const doc = {
    record_id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    guild_id: guildId,
    actor_id: actorId,
    actor_tag: actorTag,
    user_id: userId,
    user_tag: userTag,
    kind,
    minutes: Math.max(0, Math.min(1440, Number(minutes) || 0)),
    note,
  };
  await insertDoc(RECORDS, doc);
  return doc;
}

export async function listSupportRecords(guildId, { actorId = null, userId = null, limit = 25 } = {}) {
  const filter = { guild_id: guildId };
  if (actorId) filter.actor_id = actorId;
  if (userId) filter.user_id = userId;
  return findDocs(RECORDS, filter, { sort: { created_at: -1 }, limit });
}

export async function getSupportRecord(guildId, recordId) {
  return findOneDoc(RECORDS, { guild_id: guildId, record_id: recordId });
}

/** Yetkili performansi: son N gunde [{actor_id, adet, dakika}] (en coktan aza). */
export async function supportStats(guildId, { days = 30, limit = 50 } = {}) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = await findDocs(RECORDS, { guild_id: guildId, created_at: { $gte: since } }, { limit: 3000 });
  const map = new Map();
  for (const row of rows) {
    const hit = map.get(row.actor_id) ?? { actor_id: row.actor_id, adet: 0, dakika: 0 };
    hit.adet += 1;
    hit.dakika += Number(row.minutes) || 0;
    map.set(row.actor_id, hit);
  }
  return [...map.values()].sort((a, b) => b.adet - a.adet).slice(0, limit);
}
