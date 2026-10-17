/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getRedis, isRedisReady } from './redis.js';

const EXTRA_KEY = 'owner:extra';
const CACHE_TTL_MS = 30_000;

let cache = { at: 0, ids: [] };

/** Redis'teki ek sahip ID'lerini okur (kisa bellek onbellegi ile). */
export async function getExtraOwnerIds() {
  if (Date.now() - cache.at < CACHE_TTL_MS) return cache.ids;
  if (!isRedisReady()) {
    cache = { at: Date.now(), ids: [] };
    return cache.ids;
  }
  try {
    const ids = await getRedis().smembers(EXTRA_KEY);
    cache = { at: Date.now(), ids: Array.isArray(ids) ? ids : [] };
  } catch {
    cache = { at: Date.now(), ids: cache.ids }; // hata: eski onbellegi koru
  }
  return cache.ids;
}

/** Kullanici sahip mi? (ana sahip veya gecici ek sahip) */
export async function isOwnerUser(config, userId) {
  if (!userId) return false;
  if ((config?.ownerIds ?? []).includes(userId)) return true;
  const extras = await getExtraOwnerIds();
  return extras.includes(userId);
}

/** Geçici ek sahip ekler (yalnizca ana sahip cagirmali). */
export async function addExtraOwner(userId) {
  if (!isRedisReady()) return { ok: false, error: 'redis_hazir_degil' };
  await getRedis().sadd(EXTRA_KEY, userId);
  cache = { at: 0, ids: [] };
  return { ok: true };
}

/** Geçici ek sahibi cikarir. */
export async function removeExtraOwner(userId) {
  if (!isRedisReady()) return { ok: false, error: 'redis_hazir_degil' };
  const removed = await getRedis().srem(EXTRA_KEY, userId);
  cache = { at: 0, ids: [] };
  return { ok: true, removed: Number(removed) > 0 };
}

/** Ek sahip listesi (owner raporu icin). */
export async function listExtraOwners() {
  return getExtraOwnerIds();
}

/**
 * Bu kullanici ANA sahip mi? (config.ownerIds[0])
 * !sahip-ekle / !sahip-çıkar icin kullanilir.
 */
export function isPrimaryOwner(config, userId) {
  return (config?.ownerIds ?? [])[0] === userId;
}
