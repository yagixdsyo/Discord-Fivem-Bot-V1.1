/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../../db/index.js';
import { getRedis, isRedisReady } from '../../../core/redis.js';

const memInc = new Map(); // `${guildId}:${key}` -> n
const memLast = new Map(); // `${guildId}:${key}` -> ms

function splitCompound(compound) {
  const index = compound.indexOf(':');
  return [compound.slice(0, index), compound.slice(index + 1)];
}

/** Bir log kaydini sayar. */
export async function incLogCounter(guildId, key) {
  if (!guildId || !key) return;
  if (isRedisReady()) {
    try {
      const redis = getRedis();
      await redis.hincrby(`loginc:${guildId}`, key, 1);
      await redis.hset(`loglast:${guildId}`, key, String(Date.now()));
      return;
    } catch {
      /* bellek yoluna dus */
    }
  }
  const compound = `${guildId}:${key}`;
  memInc.set(compound, (memInc.get(compound) ?? 0) + 1);
  memLast.set(compound, Date.now());
}

/** Redis/bellek artislarini MongoDB'ye tasir (periyodik cagrilir). */
export async function flushCounters(guildIds = []) {
  if (!isDbReady()) return;

  for (const guildId of guildIds) {
    const ops = [];

    if (isRedisReady()) {
      try {
        const redis = getRedis();
        const [inc, last] = await Promise.all([
          redis.hgetall(`loginc:${guildId}`),
          redis.hgetall(`loglast:${guildId}`),
        ]);
        for (const [key, raw] of Object.entries(inc ?? {})) {
          const amount = Number.parseInt(raw, 10);
          if (!Number.isFinite(amount) || amount <= 0) continue;
          const remaining = await redis.hincrby(`loginc:${guildId}`, key, -amount);
          if (remaining <= 0) await redis.hdel(`loginc:${guildId}`, key);
          const lastAt = Number.parseInt(last?.[key] ?? '0', 10);
          ops.push(buildOp(guildId, key, amount, lastAt));
          if (lastAt > 0) await redis.hdel(`loglast:${guildId}`, key);
        }
      } catch {
        /* yut */
      }
    }

    // Bellek kayitlari (redis yokken veya hata durumunda)
    for (const [compound, amount] of [...memInc.entries()]) {
      const [gid, key] = splitCompound(compound);
      if (gid !== guildId || amount <= 0) continue;
      memInc.delete(compound);
      const lastAt = memLast.get(compound) ?? 0;
      memLast.delete(compound);
      ops.push(buildOp(guildId, key, amount, lastAt));
    }

    if (ops.length > 0) {
      try {
        await getCollection('log_counters').bulkWrite(ops, { ordered: false });
      } catch {
        /* yut */
      }
    }
  }
}

function buildOp(guildId, key, amount, lastAt) {
  const now = new Date();
  const update = {
    $inc: { total: amount },
    $set: { updated_at: now },
    $setOnInsert: { created_at: now, guild_id: guildId, key },
  };
  if (lastAt > 0) update.$max = { last_at: new Date(lastAt) };
  return { updateOne: { filter: { guild_id: guildId, key }, update, upsert: true } };
}

/** Sunucunun tum kanal sayaçlarini doner: Map<key, {total, lastAt}> */
export async function readCounters(guildId) {
  const rows = new Map();
  const ensure = (key) => {
    if (!rows.has(key)) rows.set(key, { total: 0, lastAt: 0 });
    return rows.get(key);
  };

  if (isDbReady()) {
    try {
      const docs = await getCollection('log_counters').find({ guild_id: guildId }).toArray();
      for (const doc of docs) {
        const row = ensure(doc.key);
        row.total += Number(doc.total ?? 0);
        const at = doc.last_at ? new Date(doc.last_at).getTime() : 0;
        if (Number.isFinite(at) && at > row.lastAt) row.lastAt = at;
      }
    } catch {
      /* yut */
    }
  }

  if (isRedisReady()) {
    try {
      const redis = getRedis();
      const [inc, last] = await Promise.all([
        redis.hgetall(`loginc:${guildId}`),
        redis.hgetall(`loglast:${guildId}`),
      ]);
      for (const [key, raw] of Object.entries(inc ?? {})) {
        const amount = Number.parseInt(raw, 10);
        if (Number.isFinite(amount) && amount > 0) ensure(key).total += amount;
      }
      for (const [key, raw] of Object.entries(last ?? {})) {
        const at = Number.parseInt(raw, 10);
        if (Number.isFinite(at) && at > ensure(key).lastAt) ensure(key).lastAt = at;
      }
    } catch {
      /* yut */
    }
  } else {
    for (const [compound, amount] of memInc.entries()) {
      const [gid, key] = splitCompound(compound);
      if (gid === guildId) ensure(key).total += amount;
    }
    for (const [compound, at] of memLast.entries()) {
      const [gid, key] = splitCompound(compound);
      if (gid === guildId && at > ensure(key).lastAt) ensure(key).lastAt = at;
    }
  }

  return rows;
}

/**
 * Sayaçlari sifirlar.
 * @param {string} guildId
 * @param {string[]|null} keys null ise tumu
 * @returns {Promise<number>} sifirlanan kayit sayisi
 */
export async function resetCounters(guildId, keys = null) {
  let touched = 0;

  if (isDbReady()) {
    try {
      const filter = { guild_id: guildId };
      if (Array.isArray(keys)) filter.key = { $in: keys };
      const result = await getCollection('log_counters').updateMany(filter, {
        $set: { total: 0, last_at: null, updated_at: new Date() },
      });
      touched += result.modifiedCount ?? 0;
    } catch {
      /* yut */
    }
  }

  if (isRedisReady()) {
    try {
      const redis = getRedis();
      if (Array.isArray(keys)) {
        if (keys.length > 0) {
          await redis.hdel(`loginc:${guildId}`, ...keys);
          await redis.hdel(`loglast:${guildId}`, ...keys);
        }
      } else {
        await redis.del(`loginc:${guildId}`, `loglast:${guildId}`);
      }
      touched += keys?.length ?? 1;
    } catch {
      /* yut */
    }
  }

  for (const [compound] of [...memInc.entries()]) {
    const [gid, key] = splitCompound(compound);
    if (gid !== guildId) continue;
    if (keys && !keys.includes(key)) continue;
    memInc.delete(compound);
    memLast.delete(compound);
    touched += 1;
  }

  return touched;
}
