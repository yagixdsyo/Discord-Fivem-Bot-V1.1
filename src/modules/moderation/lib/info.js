/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../../db/index.js';

/** Kullanicinin sunucu kara listesinde olup olmadigini doner (kayit veya null). */
export async function blacklistCheck(guildId, userId) {
  if (!isDbReady()) return null;
  try {
    return await getCollection('blacklist_users').findOne({ guild_id: guildId, user_id: userId });
  } catch {
    return null;
  }
}
