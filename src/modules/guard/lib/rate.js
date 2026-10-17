/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getRedis, isRedisReady } from '../../../core/redis.js';

const mem = new Map(); // key -> {count, resetAt}

function memKey(guildId, moduleKey, actorId) {
  return `${guildId}:${moduleKey}:${actorId}`;
}

function memHit(key, limit, windowMs) {
  const now = Date.now();
  let entry = mem.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    mem.set(key, entry);
  }
  entry.count += 1;
  return { count: entry.count, exceeded: entry.count >= limit };
}

/**
 * @param {{guildId: string, module: string, actorId?: string, limit?: number, windowSec?: number}} opts
 * @returns {Promise<{count: number, exceeded: boolean, limit: number}>}
 */
export async function hitLimit({ guildId, module, actorId = 'global', limit = 1, windowSec = 10 }) {
  const safeLimit = Math.max(1, Number(limit) || 1);
  const windowMs = Math.max(1, Number(windowSec) || 10) * 1000;

  if (isRedisReady()) {
    try {
      const redis = getRedis();
      const key = `guard:rate:${guildId}:${module}:${actorId}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.pexpire(key, windowMs);
      return { count, exceeded: count >= safeLimit, limit: safeLimit };
    } catch {
      /* bellek yoluna dus */
    }
  }

  const result = memHit(memKey(guildId, module, actorId), safeLimit, windowMs);
  return { ...result, limit: safeLimit };
}

/** Pencereyi sifirlar (test/undo icin). */
export async function resetLimit({ guildId, module, actorId = 'global' }) {
  const key = `guard:rate:${guildId}:${module}:${actorId}`;
  if (isRedisReady()) {
    try {
      await getRedis().del(key);
    } catch {
      /* yut */
    }
  }
  mem.delete(memKey(guildId, module, actorId));
}

export function clearRateMemory() {
  mem.clear();
}
