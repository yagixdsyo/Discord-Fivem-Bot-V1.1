/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { deleteDocs } from '../../fivem/lib/store.js';
import { clearSnipeGuild } from '../../moderation/lib/snipe.js';

export const PURGE_TYPES = ['snipe', 'dmlog', 'bekleme'];

/**
 * @param {object} guild Discord guild
 * @param {{types?: string[]}} opts silinecek turler (varsayilan hepsi)
 * @returns {Promise<{snipe: number, dmlog: number, bekleme: number}>}
 */
export async function purgeGuildData(guild, { types = PURGE_TYPES } = {}) {
  const wanted = new Set(types);
  const counts = { snipe: 0, dmlog: 0, bekleme: 0 };

  if (wanted.has('snipe')) {
    counts.snipe = await clearSnipeGuild(guild).catch(() => 0);
  }

  if (wanted.has('dmlog')) {
    counts.dmlog = await deleteDocs('dm_logs', { guild_id: guild.id }).catch(() => 0);
  }

  if (wanted.has('bekleme')) {
    let total = 0;
    for (const collection of ['support_waits', 'support_records', 'complaints', 'feedback']) {
      total += await deleteDocs(collection, { guild_id: guild.id }).catch(() => 0);
    }
    counts.bekleme = total;
  }

  return counts;
}
