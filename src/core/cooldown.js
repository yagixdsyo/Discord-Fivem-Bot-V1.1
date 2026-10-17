/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getRedis, isRedisReady } from './redis.js';

const ABUSE_WINDOW_SECONDS = 60;
const ABUSE_LIMIT = 5;
const ABUSE_MUTE_SECONDS = 60;

function userKey(guildId, userId, command) {
  return `cd:u:${guildId ?? 'dm'}:${userId}:${command}`;
}

function guildKey(guildId, command) {
  return `cd:g:${guildId}:${command}`;
}

function abuseCountKey(guildId, userId) {
  return `abuse:c:${guildId ?? 'dm'}:${userId}`;
}

function abuseMuteKey(guildId, userId) {
  return `abuse:m:${guildId ?? 'dm'}:${userId}`;
}

/**
 * Cooldown kontrolu ve kaydi.
 * @param {{userId: string, guildId?: string|null, command: string, seconds?: number, guildSeconds?: number}} opts
 * @returns {Promise<{limited: boolean, retryAfterMs?: number, scope?: 'kullanici'|'sunucu'}>}
 */
export async function checkCooldown({ userId, guildId, command, seconds, guildSeconds }) {
  if (!isRedisReady()) return { limited: false };
  const redis = getRedis();

  if (guildId && guildSeconds > 0) {
    const ok = await redis.set(guildKey(guildId, command), '1', 'EX', guildSeconds, 'NX');
    if (ok !== 'OK') {
      const ttl = await redis.ttl(guildKey(guildId, command));
      return { limited: true, retryAfterMs: Math.max(0, ttl) * 1000, scope: 'sunucu' };
    }
  }

  if (seconds > 0) {
    const ok = await redis.set(userKey(guildId, userId, command), '1', 'EX', seconds, 'NX');
    if (ok !== 'OK') {
      const ttl = await redis.ttl(userKey(guildId, userId, command));
      return { limited: true, retryAfterMs: Math.max(0, ttl) * 1000, scope: 'kullanici' };
    }
  }

  return { limited: false };
}

/**
 * Hatali kullanim sayaci: esik asilirsa 60 sn bot-susturma.
 * @returns {Promise<{count: number, muted: boolean, muteSeconds?: number}>}
 */
export async function markAbuse({ guildId, userId }) {
  if (!isRedisReady()) return { count: 0, muted: false };
  const redis = getRedis();
  const key = abuseCountKey(guildId, userId);

  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, ABUSE_WINDOW_SECONDS);

  if (count >= ABUSE_LIMIT) {
    await redis.set(abuseMuteKey(guildId, userId), '1', 'EX', ABUSE_MUTE_SECONDS);
    await redis.del(key);
    return { count, muted: true, muteSeconds: ABUSE_MUTE_SECONDS };
  }
  return { count, muted: false };
}

/** Kullanici bot-susturma altinda mi? Kalan sureyi (ms) doner; 0 = degil. */
export async function abuseMuteRemaining({ guildId, userId }) {
  if (!isRedisReady()) return 0;
  const ttl = await getRedis().ttl(abuseMuteKey(guildId, userId));
  return ttl > 0 ? ttl * 1000 : 0;
}

/** Basarili komutta hata sayacini sifirla. */
export async function clearAbuse({ guildId, userId }) {
  if (!isRedisReady()) return;
  await getRedis().del(abuseCountKey(guildId, userId));
}

export const COOLDOWN_CONSTANTS = Object.freeze({
  ABUSE_WINDOW_SECONDS,
  ABUSE_LIMIT,
  ABUSE_MUTE_SECONDS,
});
