/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from 'discord.js';
import { clearAuditQueue, resolveAuditActor } from '../../guard/lib/auditQueue.js';

/**
 * @param {import('discord.js').Guild} guild
 * @param {AuditLogEvent|number|null} type null ise tum turler
 * @param {string|null} targetId hedef (uye/kanal/rol/mesaj yazari) id
 * @param {{ channelId?: string|null, important?: boolean }} [opts]
 * @returns {Promise<{actorId: string|null, actorTag: string|null, reason: string|null}|null>}
 */
export async function findAuditActor(guild, type, targetId = null, opts = {}) {
  if (!guild) return null;
  const { channelId = null, important = false } = opts;

  const data = await resolveAuditActor(guild, type ?? null, targetId, {
    channelId,
    force: Boolean(important),
  });
  if (!data) return null;

  return {
    actorId: data.actorId ?? null,
    actorTag: data.actorTag ?? null,
    reason: data.reason ?? null,
  };
}

/** Onbellegi temizler (test/kapanis). */
export function clearAuditCache() {
  clearAuditQueue();
}

export { AuditLogEvent };
