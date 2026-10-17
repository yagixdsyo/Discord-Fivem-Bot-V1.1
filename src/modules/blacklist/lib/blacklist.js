/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { insertDoc, findDocs, findOneDoc, deleteDocs, updateDoc } from '../../fivem/lib/store.js';

const BLACKLIST = 'blacklist_records';

export async function isBlacklistedUser(guildId, userId) {
  const doc = await findOneDoc(BLACKLIST, { guild_id: guildId, user_id: userId });
  return Boolean(doc && doc.type === 'player');
}

export async function addBlacklist({ guildId, userId, type = 'player', reason = null }) {
  const doc = { guild_id: guildId, user_id: userId, type, reason, created_at: new Date().toISOString() };
  const existing = await findOneDoc(BLACKLIST, { guild_id: guildId, user_id: userId });
  if (existing) {
    await updateDoc(BLACKLIST, { guild_id: guildId, user_id: userId }, doc);
  } else {
    await insertDoc(BLACKLIST, doc);
  }
  return doc;
}

export async function removeBlacklist(guildId, userId) {
  return deleteDocs(BLACKLIST, { guild_id: guildId, user_id: userId });
}

export async function listBlacklist(guildId, { type = null, limit = 100 } = {}) {
  const filter = { guild_id: guildId };
  if (type) filter.type = type;
  return findDocs(BLACKLIST, filter, { sort: { created_at: -1 }, limit });
}

export async function blacklistLookup(guildId, userId) {
  return findOneDoc(BLACKLIST, { guild_id: guildId, user_id: userId });
}
