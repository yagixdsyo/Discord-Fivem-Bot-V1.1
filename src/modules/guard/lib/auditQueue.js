/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AuditLogEvent } from 'discord.js';

const HIT_TTL_MS = 10_000;
const ENTRY_WINDOW_MS = 15_000;
const MIN_GAP_MS = 2000;
const RETRY_DELAYS = [180, 300];
const CACHE_CAP = 800;
const RECENT_CAP = 60;

const hitCache = new Map(); // guild:type:target:channel -> {at, data}
const recentByGuild = new Map(); // guildId -> {at, entries}
const inflight = new Map(); // guildId:type -> Promise
let lastFetchAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function keyFor(guildId, type, targetId, channelId) {
  return `${guildId}:${type ?? 'any'}:${targetId ?? ''}:${channelId ?? ''}`;
}

function entryChannelId(entry) {
  if (entry?.extra?.channel?.id) return entry.extra.channel.id;
  if (entry?.targetType === 'CHANNEL' && entry?.target?.id && !entry.target.guild) return entry.target.id;
  return null;
}

function matches(entry, type, targetId, channelId, now) {
  if (!entry) return false;
  if (type !== null && type !== undefined && entry.actionType !== type && entry.action !== type) {
    // discord.js entry.actionType sayisal; entry.action kisa kod (ör. 'channelDelete')
    return false;
  }
  if (targetId && entry.target?.id !== targetId) return false;
  if (channelId && entryChannelId(entry) !== channelId) return false;
  if (now - (entry.createdTimestamp ?? 0) > ENTRY_WINDOW_MS) return false;
  return true;
}

function toData(entry) {
  return {
    actorId: entry?.executor?.id ?? null,
    actorTag: entry?.executor?.username ?? null,
    reason: entry?.reason ?? null,
    entry,
  };
}

function searchRecent(guildId, type, targetId, channelId) {
  const bucket = recentByGuild.get(guildId);
  if (!bucket) return null;
  const now = Date.now();
  for (const entry of bucket.entries) {
    if (matches(entry, type, targetId, channelId, now)) return entry;
  }
  return null;
}

function prune() {
  if (hitCache.size <= CACHE_CAP) return;
  const excess = hitCache.size - CACHE_CAP;
  let removed = 0;
  for (const key of hitCache.keys()) {
    hitCache.delete(key);
    removed += 1;
    if (removed >= excess) break;
  }
}

async function fetchOnce(guild, type) {
  const inflightKey = `${guild.id}:${type ?? 'any'}`;
  const existing = inflight.get(inflightKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const options = { limit: 10 };
      if (type !== null && type !== undefined) options.type = type;
      const logs = await guild.fetchAuditLogs(options);
      const entries = [...logs.entries.values()];
      const previous = recentByGuild.get(guild.id)?.entries ?? [];
      recentByGuild.set(guild.id, {
        at: Date.now(),
        entries: [...entries, ...previous].slice(0, RECENT_CAP),
      });
      return entries;
    } catch {
      return [];
    }
  })().finally(() => inflight.delete(inflightKey));

  inflight.set(inflightKey, promise);
  return promise;
}

/**
 * Olayi yapan (executor) bilgisini cozer.
 *
 * @param {import('discord.js').Guild} guild
 * @param {number|null} type AuditLogEvent (null: filtre yok)
 * @param {string|null} targetId hedef id (uye/kanal/rol/mesaj yazari)
 * @param {{ channelId?: string|null, force?: boolean, attempts?: number, minGapMs?: number }} [opts]
 *   force: true -> hiz sinirini beklemeden (onemli olaylar) yeniden dener.
 * @returns {Promise<{actorId: string|null, actorTag: string|null, reason: string|null, entry: object}|null>}
 */
export async function resolveAuditActor(guild, type, targetId = null, opts = {}) {
  if (!guild?.id) return null;
  const { channelId = null, force = false, attempts = 3, minGapMs = MIN_GAP_MS } = opts;

  const cacheKey = keyFor(guild.id, type, targetId, channelId);
  const hit = hitCache.get(cacheKey);
  if (hit && Date.now() - hit.at < HIT_TTL_MS) return hit.data;

  const maxAttempts = force ? Math.max(1, attempts) : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const found = searchRecent(guild.id, type, targetId, channelId);
    if (found) {
      const data = toData(found);
      hitCache.set(cacheKey, { at: Date.now(), data });
      prune();
      return data;
    }

    if (attempt > 0) await sleep(RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)]);

    const now = Date.now();
    if (!force && now - lastFetchAt < minGapMs) return null;
    if (force && now - lastFetchAt < 250) {
      // Patlama halinde bile API'yi bogmamak icin cok kisa bir kapi
      await sleep(70);
    }
    lastFetchAt = Date.now();
    await fetchOnce(guild, type);
  }

  return null;
}

/** Test/temizlik icin. */
export function clearAuditQueue() {
  hitCache.clear();
  recentByGuild.clear();
  inflight.clear();
  lastFetchAt = 0;
}

export { AuditLogEvent };
