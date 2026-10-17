/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getRedis, isRedisReady } from '../../../core/redis.js';

const mem = new Map(); // guildId -> untilMs
const DEFAULT_MINUTES = 10;

function keyFor(guildId) {
  return `guard:raid:${guildId}`;
}

export async function isRaidActive(guildId) {
  if (isRedisReady()) {
    try {
      const ttl = await getRedis().pttl(keyFor(guildId));
      if (ttl > 0) return true;
    } catch {
      /* bellek */
    }
  }
  const until = mem.get(guildId);
  if (until && until > Date.now()) return true;
  if (until) mem.delete(guildId);
  return false;
}

export async function raidRemainingSec(guildId) {
  if (isRedisReady()) {
    try {
      const ttl = await getRedis().pttl(keyFor(guildId));
      return ttl > 0 ? Math.ceil(ttl / 1000) : 0;
    } catch {
      /* bellek */
    }
  }
  const until = mem.get(guildId) ?? 0;
  return until > Date.now() ? Math.ceil((until - Date.now()) / 1000) : 0;
}

export async function setRaidActive(guildId, active, { minutes = DEFAULT_MINUTES } = {}) {
  if (active) {
    const ttlMs = Math.max(1, Number(minutes) || DEFAULT_MINUTES) * 60 * 1000;
    mem.set(guildId, Date.now() + ttlMs);
    if (isRedisReady()) {
      try {
        await getRedis().set(keyFor(guildId), '1', 'PX', ttlMs);
      } catch {
        /* bellek yeter */
      }
    }
    return { ok: true, active: true, until: new Date(Date.now() + ttlMs).toISOString() };
  }

  mem.delete(guildId);
  if (isRedisReady()) {
    try {
      await getRedis().del(keyFor(guildId));
    } catch {
      /* yut */
    }
  }
  return { ok: true, active: false };
}

/**
 * Raid aktifken yeni uyeye uygulanacak islem.
 * @returns {Promise<boolean>} islem uygulandi mi
 */
export async function enforceRaidJoin(member, { mode = 'kick' } = {}) {
  if (!member?.kick) return false;
  try {
    if (mode === 'mute' && typeof member.timeout === 'function') {
      await member.timeout(10 * 60 * 1000, 'Guard: raid modu');
    } else {
      await member.kick('Guard: raid modu aktif');
    }
    return true;
  } catch {
    return false;
  }
}

export function clearRaidMemory() {
  mem.clear();
}
