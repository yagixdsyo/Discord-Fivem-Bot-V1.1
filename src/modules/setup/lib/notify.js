/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { notifyGuildSystemChannel, notifyUserDm, sendOwnerLog } from '../../../owner/lib/ownerLog.js';

/** Owner log kanalina V2 karti (varsa). */
export function logToOwnerChannel(config, payload) {
  return sendOwnerLog(payload, config);
}

/** Sunucu sahibine DM; DM kapaliysa sistem kanalina yedekler. */
export async function notifyGuildOwner(guild, config, payload) {
  let ok = false;
  if (guild?.ownerId) ok = await notifyUserDm(config, guild.ownerId, payload);
  if (!ok) ok = await notifyGuildSystemChannel(guild, payload);
  return ok;
}
