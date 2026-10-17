/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { PermissionFlagsBits } from 'discord.js';
import { getRedis, isRedisReady } from '../../../core/redis.js';

const LOCK_WINDOW_SEC = 15;
const memLocks = new Map();
const MAX_CAPTURED_ROLES = 100;

/** Tehlikeli izin maskesi (gece modu + sahip yetki alma + yetkili rol kontrolu). */
export const DANGEROUS_PERM_NAMES = Object.freeze([
  'Administrator',
  'ManageRoles',
  'ManageChannels',
  'ManageGuild',
  'BanMembers',
  'KickMembers',
  'ManageWebhooks',
  'ManageMessages',
  'ManageEmojisAndStickers',
  'MentionEveryone',
]);

export function dangerousPermMask() {
  let mask = 0n;
  for (const name of DANGEROUS_PERM_NAMES) {
    const bit = PermissionFlagsBits[name];
    if (bit !== undefined) mask |= BigInt(bit);
  }
  return mask;
}

export function hasDangerousPerms(permissionsBitfield) {
  try {
    return (BigInt(permissionsBitfield ?? 0n) & dangerousPermMask()) !== 0n;
  } catch {
    return false;
  }
}

/** Idempotent ceza kilidi. true -> kilit alindi (ceza uygulanabilir). */
export async function acquirePunishLock(guildId, userId, { windowSec = LOCK_WINDOW_SEC } = {}) {
  const key = `guard:punish:${guildId}:${userId}`;
  if (isRedisReady()) {
    try {
      const result = await getRedis().set(key, '1', 'EX', windowSec, 'NX');
      return result === 'OK';
    } catch {
      /* bellek yoluna dus */
    }
  }
  const now = Date.now();
  const until = memLocks.get(key);
  if (until && until > now) return false;
  memLocks.set(key, now + windowSec * 1000);
  if (memLocks.size > 2000) {
    for (const [memKey, memUntil] of memLocks) {
      if (memUntil <= now) memLocks.delete(memKey);
    }
  }
  return true;
}

export function clearPunishLocks() {
  memLocks.clear();
}

async function removeMatchingRoles(member, reason, predicate) {
  const removed = [];
  for (const role of member.roles.cache.values()) {
    if (role.id === member.guild.id) continue;
    if (role.managed) continue;
    if (predicate && !predicate(role)) continue;
    try {
      await member.roles.remove(role.id, reason);
      removed.push(role.id);
    } catch {
      /* tek rol hatasi cezayi durdurmaz */
    }
  }
  return removed;
}

/**
 * Cezayi uygular.
 *
 * @param {import('discord.js').Guild} guild
 * @param {{
 *   actorId: string, moduleKey: string, punishType?: string,
 *   reasonText?: string|null, dryRun?: boolean, client: import('discord.js').Client,
 *   captureRoles?: boolean,
 * }} opts
 * @returns {Promise<{
 *   ok: boolean, action: string|null, skipped?: boolean, lockHeld?: boolean,
 *   ownerProtected?: boolean, banned?: boolean, removedRoles?: string[], dryRun?: boolean,
 * }>}
 */
export async function punishActor(guild, opts) {
  const {
    actorId,
    moduleKey,
    punishType = 'rolleri-al',
    reasonText = null,
    dryRun = false,
    client,
    captureRoles = true,
  } = opts;

  const reason = `Guard (${moduleKey}): ${reasonText ?? 'koruma ihlali'}`;

  if (!actorId || actorId === client?.user?.id) return { ok: false, action: null, skipped: true };
  if (dryRun) return { ok: true, action: punishType, dryRun: true, removedRoles: [] };

  const member = await guild.members.fetch(actorId).catch(() => null);
  if (!member) return { ok: false, action: null, reason: 'uye_yok' };

  // Sunucu sahibi: ban/kick edilemez; tehlikeli yetkileri alinir (12.2)
  if (actorId === guild.ownerId) {
    const removed = await removeMatchingRoles(
      member,
      reason,
      (role) => hasDangerousPerms(role.permissions?.bitfield),
    );
    return { ok: true, action: 'yetki-al', ownerProtected: true, removedRoles: removed };
  }

  if (punishType === 'sadece-geri-al') return { ok: true, action: 'sadece-geri-al' };
  if (punishType === 'uyar') return { ok: true, action: 'uyar' };

  const lockHeld = await acquirePunishLock(guild.id, actorId);
  if (!lockHeld) return { ok: false, action: punishType, skipped: true, lockHeld: false };

  const removedRoles =
    captureRoles && punishType === 'rolleri-al'
      ? member.roles.cache
          .filter((role) => role.id !== guild.id && !role.managed)
          .map((role) => role.id)
          .slice(0, MAX_CAPTURED_ROLES)
      : [];

  try {
    if (punishType === 'ban') {
      await guild.members.ban(actorId, { reason });
      return { ok: true, action: 'ban', banned: true, removedRoles };
    }
    if (punishType === 'kick') {
      await member.kick(reason);
      return { ok: true, action: 'kick' };
    }
    if (punishType === 'rolleri-al') {
      const removed = await removeMatchingRoles(member, reason, () => true);
      return { ok: true, action: 'rolleri-al', removedRoles: removed.length > 0 ? removed : removedRoles };
    }
  } catch {
    return { ok: false, action: punishType, reason: 'uygulanamadi' };
  }

  return { ok: true, action: punishType, removedRoles };
}

/** Cezayi geri alir: unban + rol iadesi (/guard-geri-al). */
export async function liftPunishment(guild, { actorId, action, removedRoles = [] }) {
  const results = { unbanned: false, rolesRestored: 0 };

  if (action === 'ban') {
    try {
      await guild.members.unban(actorId, 'Guard: yanlis ceza geri alindi');
      results.unbanned = true;
    } catch {
      /* yut */
    }
  }

  if (Array.isArray(removedRoles) && removedRoles.length > 0) {
    const member = await guild.members.fetch(actorId).catch(() => null);
    if (member) {
      for (const roleId of removedRoles) {
        try {
          await member.roles.add(roleId, 'Guard: yanlis ceza geri alindi');
          results.rolesRestored += 1;
        } catch {
          /* yut */
        }
      }
    }
  }

  return results;
}
