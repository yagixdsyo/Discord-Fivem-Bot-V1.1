/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getRedis, isRedisReady } from '../../../core/redis.js';

const TTL_SECONDS = 15;
const mem = new Map(); // `${guildId}:${targetId}` -> {roleIds:Set, expireAt}

function redisKey(guildId, targetId) {
  return `guard:ok:${guildId}:${targetId}`;
}

/** Komut tarafindan verilecek rolleri isaretler (append + TTL yenile). */
export async function markSanctioned({ guildId, targetId, roleIds = [] }) {
  if (!guildId || !targetId || !Array.isArray(roleIds) || roleIds.length === 0) return;

  const memKey = `${guildId}:${targetId}`;
  const entry = mem.get(memKey) ?? { roleIds: new Set(), expireAt: 0 };
  for (const id of roleIds) entry.roleIds.add(String(id));
  entry.expireAt = Date.now() + TTL_SECONDS * 1000;
  mem.set(memKey, entry);

  if (isRedisReady()) {
    try {
      await getRedis().sadd(redisKey(guildId, targetId), ...roleIds.map(String));
      await getRedis().expire(redisKey(guildId, targetId), TTL_SECONDS);
    } catch {
      /* bellek yeterli */
    }
  }
}

/** Isareti tuketir (tek kullanimlik: okundugunda silinir). */
export async function consumeSanctioned({ guildId, targetId }) {
  const result = new Set();

  const memKey = `${guildId}:${targetId}`;
  const entry = mem.get(memKey);
  if (entry) {
    if (entry.expireAt > Date.now()) {
      for (const id of entry.roleIds) result.add(id);
    }
    mem.delete(memKey);
  }

  if (isRedisReady()) {
    try {
      const key = redisKey(guildId, targetId);
      const members = await getRedis().smembers(key);
      if (Array.isArray(members)) {
        for (const id of members) result.add(String(id));
      }
      await getRedis().del(key);
    } catch {
      /* bellek sonucu yeterli */
    }
  }

  return result;
}

/** Test izolasyonu. */
export function clearSanctionMemory() {
  mem.clear();
}
