/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../../db/index.js';

export async function getMappedKeepIds(guildId) {
  const keepChannelIds = [];
  const keepRoleIds = [];
  if (!isDbReady()) return { keepChannelIds, keepRoleIds };

  try {
    const channels = await getCollection('channels_map').find({ guild_id: guildId }).toArray();
    for (const doc of channels) {
      if (doc.channel_id) keepChannelIds.push(String(doc.channel_id));
      if (doc.category_id) keepChannelIds.push(String(doc.category_id));
    }
  } catch {
    /* yut */
  }

  try {
    const roles = await getCollection('roles_map').find({ guild_id: guildId }).toArray();
    for (const doc of roles) {
      if (doc.role_id) keepRoleIds.push(String(doc.role_id));
    }
  } catch {
    /* yut */
  }

  return { keepChannelIds, keepRoleIds };
}
