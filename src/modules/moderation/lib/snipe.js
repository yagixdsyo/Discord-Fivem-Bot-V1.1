/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getRedis, isRedisReady } from '../../../core/redis.js';

const TTL_SECONDS = 3600;
const CAP = 20;
const mem = new Map(); // channelId -> dizi (en yeni ilk)

function redisKey(channelId) {
  return `snipe:${channelId}`;
}

/**
 * @param {string} channelId
 * @param {{kind: 'silme'|'duzenleme', id?: string, authorId?: string|null, authorTag?: string|null, content?: string, oldContent?: string|null, newContent?: string|null, hadAttachments?: boolean, at?: number}} entry
 */
export async function pushSnipe(channelId, entry) {
  if (!channelId || !entry) return;
  const doc = { ...entry, at: entry.at ?? Date.now() };

  const arr = mem.get(channelId) ?? [];
  arr.unshift(doc);
  if (arr.length > CAP) arr.length = CAP;
  mem.set(channelId, arr);

  if (isRedisReady()) {
    try {
      const redis = getRedis();
      await redis.lpush(redisKey(channelId), JSON.stringify(doc));
      await redis.ltrim(redisKey(channelId), 0, CAP - 1);
      await redis.expire(redisKey(channelId), TTL_SECONDS);
    } catch {
      /* bellek yeterli */
    }
  }
}

/**
 * @param {string} channelId
 * @param {{count?: number, kind?: 'silme'|'duzenleme'|null}} opts
 */
export async function getSnipes(channelId, { count = 1, kind = null } = {}) {
  let list = [];
  if (isRedisReady()) {
    try {
      const raw = await getRedis().lrange(redisKey(channelId), 0, Math.max(count * 3, CAP) - 1);
      list = raw
        .map((item) => {
          try {
            return JSON.parse(item);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      list = [];
    }
  }
  if (list.length === 0) list = mem.get(channelId) ?? [];
  const filtered = kind ? list.filter((item) => item.kind === kind) : list;
  return filtered.slice(0, count);
}

/** Test izolasyonu. */
export function clearSnipeMemory() {
  mem.clear();
}

/** Sunucu genelinde snipe kayitlarini siler; etkilenen kanal sayisini dondurur. */
export async function clearSnipeGuild(guild) {
  let affected = mem.size;
  mem.clear();
  if (isRedisReady() && guild?.channels?.cache) {
    let redisCount = 0;
    for (const channel of guild.channels.cache.values()) {
      try {
        redisCount += await getRedis().del(redisKey(channel.id));
      } catch {
        /* tek kanal hatasi digerlerini etkilemez */
      }
    }
    affected = Math.max(affected, redisCount);
  }
  return affected;
}
