/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { PermissionFlagsBits } from 'discord.js';
import { getCollection, isDbReady } from '../db/index.js';
import { getRedis, isRedisReady } from './redis.js';
import { getLogger } from './logger.js';
import { getRankLevels, memberRankLevel } from './rankLevels.js';

/**
 * Saf karar fonksiyonu (test edilebilir).
 * @param {{command: object, member?: object|null, guild?: object|null, isOwner?: boolean, permNode?: object|null, rankLevels?: Record<string, number>|null}} opts
 * @returns {{ok: boolean, reason?: 'owner_only'|'discord_permission'|'node'|'rank', missing?: string[], node?: string, rank?: {required: number, member: number}}}
 */
export function decidePermission({ command, member, guild, isOwner = false, permNode = null, rankLevels = null }) {
  if (command.ownerOnly) {
    return isOwner ? { ok: true } : { ok: false, reason: 'owner_only' };
  }

  if (isOwner) return { ok: true };

  if (guild && member && guild.ownerId === member.id) return { ok: true };
  if (member?.permissions?.has?.(PermissionFlagsBits.Administrator)) return { ok: true };

  const perm = command.permission ?? {};
  const hasDiscordCondition = Array.isArray(perm.discord) && perm.discord.length > 0;
  const hasNodeCondition = Boolean(perm.node);
  const requiredRank = Math.floor(Number(perm.rankLevel));
  const hasRankCondition = Number.isFinite(requiredRank) && requiredRank >= 1;

  if (!hasDiscordCondition && !hasNodeCondition && !hasRankCondition) return { ok: true };

  // Discord izni kosulu
  let discordOk = false;
  let missing = [];
  if (hasDiscordCondition) {
    missing = perm.discord.filter((name) => {
      const bit = PermissionFlagsBits[name];
      return bit === undefined || !member?.permissions?.has?.(bit);
    });
    discordOk = missing.length === 0;
  }

  // Yetki dugumu kosulu (perm_nodes: role_ids / user_ids)
  let nodeOk = false;
  if (hasNodeCondition && member) {
    const userIds = permNode?.user_ids ?? [];
    const roleIds = permNode?.role_ids ?? [];
    nodeOk =
      userIds.includes(member.id) ||
      roleIds.some((roleId) => member.roles?.cache?.has?.(roleId));
  }

  // Rutbe seviyesi kosulu (rank_levels: rol -> seviye)
  let rankOk = false;
  let memberRank = 0;
  if (hasRankCondition && member) {
    memberRank = memberRankLevel(member, rankLevels);
    rankOk = memberRank >= requiredRank;
  }

  if (discordOk || nodeOk || rankOk) return { ok: true };

  if (hasNodeCondition && !hasDiscordCondition) {
    return { ok: false, reason: 'node', node: perm.node };
  }
  if (hasRankCondition && !hasDiscordCondition && !hasNodeCondition) {
    return { ok: false, reason: 'rank', rank: { required: requiredRank, member: memberRank } };
  }
  return { ok: false, reason: 'discord_permission', missing };
}

const warnedNodes = new Set();
const warnedRanks = new Set();

/** Yetki dugumu eslemesini Redis onbellekli okur. */
export async function getPermNode(guildId, node) {
  if (!guildId || !node) return null;
  const cacheKey = `perm:${guildId}:${node}`;

  if (isRedisReady()) {
    const cached = await getRedis().get(cacheKey);
    if (cached === 'yok') return null;
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        /* bozuk onbellek -> DB'ye in */
      }
    }
  }

  if (!isDbReady()) return null;

  try {
    const doc = await getCollection('perm_nodes').findOne({ guild_id: guildId, node });
    if (isRedisReady()) {
      await getRedis().set(cacheKey, doc ? JSON.stringify(doc) : 'yok', 'EX', 60);
    }
    return doc ?? null;
  } catch {
    return null;
  }
}

/** Komut icin kullanici katmani karari (perm_nodes + rank_levels erisimi dahil). */
export async function canRun({ command, member, guild, isOwner = false }) {
  let permNode = null;
  if (command.permission?.node && guild?.id) {
    permNode = await getPermNode(guild.id, command.permission.node);
    if (!permNode && !warnedNodes.has(`${guild.id}:${command.permission.node}`)) {
      warnedNodes.add(`${guild.id}:${command.permission.node}`);
      getLogger().info(
        { guildId: guild.id, node: command.permission.node },
        'Yetki dugumu icin esleme yok (/yetki-ayar ile tanimlanabilir).',
      );
    }
  }

  let rankLevels = null;
  const requiredRank = Math.floor(Number(command.permission?.rankLevel));
  if (Number.isFinite(requiredRank) && requiredRank >= 1 && guild?.id) {
    rankLevels = await getRankLevels(guild.id);
    if (!Object.keys(rankLevels).length && !warnedRanks.has(guild.id)) {
      warnedRanks.add(guild.id);
      getLogger().info(
        { guildId: guild.id, requiredRank },
        'Rutbe seviyesi tanimli degil (/yetki-ayar rutbe ile rol -> seviye esleyin).',
      );
    }
  }

  return decidePermission({ command, member, guild, isOwner, permNode, rankLevels });
}

/** Komut kullanilabilir mi - hizli gorunurluk kontrolu (yardim menusu filtreleri). */
export async function canSeeCommand({ command, member, guild, isOwner = false }) {
  if (command.ownerOnly && !isOwner) return false;
  const result = await canRun({ command, member, guild, isOwner });
  return result.ok;
}
