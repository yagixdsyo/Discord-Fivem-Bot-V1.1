/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { findDocs, findOneDoc, insertDoc, updateDoc } from './store.js';

const COL = 'olusums';
const BANS = 'olusum_bans';
const PERMS = 'olusum_perms';

export async function createOlusum({ guildId, name, roleId, ownerId = null, ownerTag = null, limit = 0 }) {
  const existing = await findOneDoc(COL, { guild_id: guildId, name });
  if (existing?.active) return { ok: false, error: 'isim_kullanimda' };

  const doc = {
    olusum_id: `o-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    guild_id: guildId,
    name,
    role_id: roleId,
    owner_id: ownerId,
    owner_tag: ownerTag,
    limit,
    active: true,
  };
  await insertDoc(COL, doc);
  return { ok: true, doc };
}

export async function closeOlusum(guildId, olusumId) {
  const doc = await getOlusum(guildId, olusumId);
  if (!doc || !doc.active) return { ok: false, error: 'olusum_yok' };
  await updateDoc(COL, { guild_id: guildId, olusum_id: olusumId }, { active: false, closed_at: new Date().toISOString() });
  return { ok: true, doc };
}

export async function getOlusum(guildId, { olusumId = null, name = null, roleId = null } = {}) {
  if (olusumId) return findOneDoc(COL, { guild_id: guildId, olusum_id: olusumId });
  if (roleId) return findOneDoc(COL, { guild_id: guildId, role_id: roleId });
  if (name) return findOneDoc(COL, { guild_id: guildId, name });
  return null;
}

export async function searchOlusums(guildId, { active = true, limit = 25 } = {}) {
  const filter = { guild_id: guildId };
  if (active !== null) filter.active = active;
  return findDocs(COL, filter, { sort: { created_at: -1 }, limit });
}

/** Roldeki tum uye ID'lerini toplar (cache + gerekirse fetch). */
export async function collectRoleMemberIds(guild, roleId, { limit = 5000 } = {}) {
  const ids = new Set();
  for (const member of guild.members.cache.values()) {
    if (member.roles?.cache?.has(roleId)) ids.add(member.id);
    if (ids.size >= limit) break;
  }
  if (ids.size === 0) {
    try {
      const fetched = await guild.members.fetch({ limit });
      for (const member of fetched.values()) {
        if (member.roles?.cache?.has(roleId)) ids.add(member.id);
      }
    } catch {
      /* fetch kapali */
    }
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// Olusum ban kayitlari (toplu ban -> toplu unban icin ID listesi)
// ---------------------------------------------------------------------------

export async function recordOlusumBan({ guildId, olusumId, name = null, ids, by }) {
  const doc = {
    ban_id: `ob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    guild_id: guildId,
    olusum_id: olusumId,
    name,
    ids,
    count: ids.length,
    banned_by: by,
    unbanned: false,
    unbanned_by: null,
  };
  await insertDoc(BANS, doc);
  return doc;
}

export async function getLatestOlusumBan(guildId, { olusumId = null, name = null } = {}) {
  const filter = { guild_id: guildId, unbanned: false };
  if (olusumId) filter.olusum_id = olusumId;
  if (name) filter.name = name;
  const rows = await findDocs(BANS, filter, { sort: { created_at: -1 }, limit: 1 });
  return rows[0] ?? null;
}

export async function markOlusumBanUnbanned(guildId, banId, by) {
  return updateDoc(
    BANS,
    { guild_id: guildId, ban_id: banId },
    { unbanned: true, unbanned_by: by, unbanned_at: new Date().toISOString() },
  );
}

// ---------------------------------------------------------------------------
// Perm isteme akisi
// ---------------------------------------------------------------------------

export async function createPermRequest({ guildId, olusumId, name, userId, userTag = null, roleName = null, note = null }) {
  const doc = {
    perm_id: `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    guild_id: guildId,
    olusum_id: olusumId,
    name,
    user_id: userId,
    user_tag: userTag,
    role_name: roleName,
    note,
    status: 'beklemede',
    decided_by: null,
  };
  await insertDoc(PERMS, doc);
  return doc;
}

export async function getPermRequest(guildId, permId) {
  return findOneDoc(PERMS, { guild_id: guildId, perm_id: permId });
}

export async function decidePermRequest(guildId, permId, { status, by }) {
  const doc = await getPermRequest(guildId, permId);
  if (!doc) return { ok: false, error: 'talep_yok' };
  if (doc.status !== 'beklemede') return { ok: false, error: 'zaten_karar' };
  await updateDoc(PERMS, { guild_id: guildId, perm_id: permId }, { status, decided_by: by, decided_at: new Date().toISOString() });
  return { ok: true, doc: { ...doc, status, decided_by: by } };
}
