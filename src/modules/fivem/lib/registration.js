/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { countDocs, deleteDocs, findDocs, findOneDoc, insertDoc, updateDoc } from './store.js';

const COL = 'registrations';

export async function addRegistration({ guildId, userId, actorId, actorTag = null, icName, oocName = null }) {
  return insertDoc(COL, {
    guild_id: guildId,
    user_id: userId,
    actor_id: actorId,
    actor_tag: actorTag,
    ic_name: icName,
    ooc_name: oocName,
  });
}

/** Kayitli uyenin ismini gunceller. */
export async function updateRegistrationName(guildId, userId, { icName, oocName = null } = {}) {
  return updateDoc(
    COL,
    { guild_id: guildId, user_id: userId },
    { ic_name: icName, ooc_name: oocName, renamed_at: new Date().toISOString() },
  );
}

export async function listByActor(guildId, actorId, { limit = 200 } = {}) {
  return findDocs(COL, { guild_id: guildId, actor_id: actorId }, { sort: { created_at: -1 }, limit });
}

export async function countByActor(guildId, actorId) {
  return countDocs(COL, { guild_id: guildId, actor_id: actorId });
}

/** Yetkilinin kayit sayaclari: [{actor_id, adet}] (en coktan aza). days verilirse zaman filtreli. */
export async function actorCounters(guildId, { limit = 100, days = null } = {}) {
  const filter = { guild_id: guildId };
  if (days) filter.created_at = { $gte: new Date(Date.now() - Number(days) * 86_400_000).toISOString() };
  const rows = await findDocs(COL, filter, { sort: { created_at: -1 }, limit: 2000 });
  const map = new Map();
  for (const row of rows) {
    map.set(row.actor_id, (map.get(row.actor_id) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([actor_id, adet]) => ({ actor_id, adet }))
    .sort((a, b) => b.adet - a.adet)
    .slice(0, limit);
}

/** Yetkilinin kayitlarini sifirlar; silinen kayit sayisini doner. */
export async function resetByActor(guildId, actorId) {
  return deleteDocs(COL, { guild_id: guildId, actor_id: actorId });
}

/** Kullanicinin kayit gecmisi (en yeni ilk). */
export async function listByUser(guildId, userId, { limit = 20 } = {}) {
  return findDocs(COL, { guild_id: guildId, user_id: userId }, { sort: { created_at: -1 }, limit });
}

export async function getByUser(guildId, userId) {
  return findOneDoc(COL, { guild_id: guildId, user_id: userId });
}

export async function isRegistered(guildId, userId) {
  return Boolean(await getByUser(guildId, userId));
}

export async function listRecent(guildId, { limit = 25 } = {}) {
  return findDocs(COL, { guild_id: guildId }, { sort: { created_at: -1 }, limit });
}
