/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getLogger } from '../../../core/logger.js';
import { isSystemActive } from '../../../core/systemRegistry.js';
import { resolveLogChannelId } from './cache.js';
import { incLogCounter } from './counters.js';
import { enqueueLog } from './queue.js';
import { isLogChannelEnabled } from './state.js';

/**
 * @param {import('discord.js').Guild} guild
 * @param {string} key log anahtari (log_*)
 * @param {object} entry { actor, actorTag, target, targetTag, reason, lines, ids, accent, files, title }
 * @returns {Promise<boolean>} kuyruga alindi mi
 */
export async function emitLog(guild, key, entry = {}) {
  try {
    const guildId = guild?.id ?? entry.guildId ?? null;
    if (!guildId || !key) return false;

    if (!(await isSystemActive({ guildId, systemId: 'loglar' }))) return false;
    if (!(await isLogChannelEnabled(guildId, key))) return false;

    const channelId = await resolveLogChannelId(guildId, key);
    if (!channelId) return false;

    await incLogCounter(guildId, key);
    await enqueueLog({ channelId, guildId, key, entry, at: entry.at ?? Date.now() });
    return true;
  } catch (err) {
    getLogger().debug({ err: err?.message, key }, 'emitLog hatasi (yutuldu)');
    return false;
  }
}

/** Ayni kaydi birden fazla kanala gonderir (nadir kullanim). */
export async function emitLogMany(guild, keys, entry = {}) {
  const results = [];
  for (const key of keys) results.push(await emitLog(guild, key, entry));
  return results;
}
