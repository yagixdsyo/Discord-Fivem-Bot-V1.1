/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../../db/index.js';
import { dayKey, lastNDayKeys } from './util.js';

const pending = new Map(); // `${guildId}:${userId}:${day}` -> {messages, voice_seconds, voice_count}
const MEM = { daily: new Map() }; // DB'siz sorgular icin toplamlar
const openMem = new Map(); // DB'siz acik oturumlar
let flusher = null;

/** Test izolasyonu. */
export function clearStatsMemory() {
  pending.clear();
  MEM.daily.clear();
  openMem.clear();
}

function key(guildId, userId, day) {
  return `${guildId}:${userId}:${day}`;
}

function bump(guildId, userId, patch) {
  const day = dayKey();
  const mapKey = key(guildId, userId, day);
  const entry = pending.get(mapKey) ?? { guildId, userId, day, messages: 0, voice_seconds: 0, voice_count: 0 };
  entry.messages += patch.messages ?? 0;
  entry.voice_seconds += patch.voice_seconds ?? 0;
  entry.voice_count += patch.voice_count ?? 0;
  pending.set(mapKey, entry);
}

export function addMessage(guildId, userId) {
  if (!guildId || !userId) return;
  bump(guildId, userId, { messages: 1 });
}

/** Tampondaki sayimlari stats_daily'ye yazar. */
export async function flushStats() {
  if (pending.size === 0) return 0;
  const entries = [...pending.values()];
  pending.clear();
  let count = 0;

  for (const entry of entries) {
    const mapKey = key(entry.guildId, entry.userId, entry.day);
    const total = MEM.daily.get(mapKey) ?? {
      guild_id: entry.guildId,
      user_id: entry.userId,
      day: entry.day,
      messages: 0,
      voice_seconds: 0,
      voice_count: 0,
    };
    total.messages += entry.messages;
    total.voice_seconds += entry.voice_seconds;
    total.voice_count += entry.voice_count;
    MEM.daily.set(mapKey, total);

    if (isDbReady()) {
      try {
        await getCollection('stats_daily').updateOne(
          { guild_id: entry.guildId, user_id: entry.userId, day: entry.day },
          {
            $inc: { messages: entry.messages, voice_seconds: entry.voice_seconds, voice_count: entry.voice_count },
            $setOnInsert: { created_at: new Date().toISOString() },
          },
          { upsert: true },
        );
        count += 1;
      } catch {
        /* tek kayit hatasi akisi durdurmaz */
      }
    } else {
      count += 1;
    }
  }
  return count;
}

export function startStatsFlusher({ intervalMs = 30_000 } = {}) {
  if (flusher) return;
  flusher = setInterval(() => {
    flushStats().catch(() => {});
  }, intervalMs);
  flusher.unref?.();
}

export async function stopStatsFlusher() {
  if (flusher) {
    clearInterval(flusher);
    flusher = null;
  }
  await flushStats().catch(() => {});
}

// ---------------------------------------------------------------------------
// Ses oturumlari
// ---------------------------------------------------------------------------

export async function openSession(guildId, userId, channelId) {
  if (!guildId || !userId || !channelId) return;
  await closeSession(guildId, userId).catch(() => {});
  const joinedAt = new Date().toISOString();

  if (isDbReady()) {
    try {
      await getCollection('voice_sessions').insertOne({
        guild_id: guildId,
        user_id: userId,
        channel_id: channelId,
        joined_at: joinedAt,
        left_at: null,
        seconds: 0,
      });
      return;
    } catch {
      /* bellege dus */
    }
  }
  openMem.set(`${guildId}:${userId}`, { channelId, joinedAt });
}

export async function closeSession(guildId, userId) {
  if (!guildId || !userId) return 0;
  const now = Date.now();

  if (isDbReady()) {
    try {
      const open = await getCollection('voice_sessions').findOne(
        { guild_id: guildId, user_id: userId, left_at: null },
        { sort: { joined_at: -1 } },
      );
      if (!open) return 0;
      const joinedAtMs = new Date(open.joined_at).getTime() || now;
      const seconds = Math.min(Math.floor((now - joinedAtMs) / 1000), 12 * 3600);
      await getCollection('voice_sessions').updateOne(
        { _id: open._id },
        { $set: { left_at: new Date().toISOString(), seconds } },
      );
      if (seconds > 0) bump(guildId, userId, { voice_seconds: seconds, voice_count: 1 });
      return seconds;
    } catch {
      /* bellek yedegine gec */
    }
  }

  const entry = openMem.get(`${guildId}:${userId}`);
  if (!entry) return 0;
  openMem.delete(`${guildId}:${userId}`);
  const seconds = Math.min(Math.floor((now - new Date(entry.joinedAt).getTime()) / 1000), 12 * 3600);
  if (seconds > 0) bump(guildId, userId, { voice_seconds: seconds, voice_count: 1 });
  return seconds;
}

/** Acilis: cokme sonrasi acik kalan oturumlari kapatir. */
export async function recoverOpenSessions() {
  if (!isDbReady()) {
    const keys = [...openMem.keys()];
    for (const mapKey of keys) {
      const [guildId, userId] = mapKey.split(':');
      await closeSession(guildId, userId);
    }
    return keys.length;
  }
  try {
    const opens = await getCollection('voice_sessions').find({ left_at: null }).limit(500).toArray();
    const now = Date.now();
    for (const open of opens) {
      const joinedAtMs = new Date(open.joined_at).getTime() || now;
      const seconds = Math.min(Math.floor((now - joinedAtMs) / 1000), 12 * 3600);
      await getCollection('voice_sessions').updateOne(
        { _id: open._id },
        { $set: { left_at: new Date().toISOString(), seconds } },
      );
      if (seconds > 0) bump(open.guild_id, open.user_id, { voice_seconds: seconds, voice_count: 1 });
    }
    return opens.length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Sorgular
// ---------------------------------------------------------------------------

export async function getUserDaily(guildId, userId, { days = 7 } = {}) {
  const keys = lastNDayKeys(days);
  if (isDbReady()) {
    try {
      return await getCollection('stats_daily')
        .find({ guild_id: guildId, user_id: userId, day: { $in: keys } })
        .sort({ day: 1 })
        .toArray();
    } catch {
      /* bellek */
    }
  }
  return keys.map((day) => MEM.daily.get(key(guildId, userId, day))).filter(Boolean);
}

export async function getServerDaily(guildId, { days = 14 } = {}) {
  const keys = lastNDayKeys(days);
  if (isDbReady()) {
    try {
      const rows = await getCollection('stats_daily')
        .aggregate([
          { $match: { guild_id: guildId, day: { $in: keys } } },
          {
            $group: {
              _id: '$day',
              messages: { $sum: '$messages' },
              voice_seconds: { $sum: '$voice_seconds' },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray();
      return rows.map((row) => ({ day: row._id, messages: row.messages, voice_seconds: row.voice_seconds }));
    } catch {
      /* bellek */
    }
  }
  const byDay = new Map();
  for (const entry of MEM.daily.values()) {
    if (entry.guild_id !== guildId || !keys.includes(entry.day)) continue;
    const agg = byDay.get(entry.day) ?? { day: entry.day, messages: 0, voice_seconds: 0 };
    agg.messages += entry.messages;
    agg.voice_seconds += entry.voice_seconds;
    byDay.set(entry.day, agg);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export async function topUsers(guildId, { metric = 'messages', days = 7, limit = 10 } = {}) {
  const keys = lastNDayKeys(days);
  const sortField = metric === 'voice' ? 'voice_seconds' : 'messages';

  if (isDbReady()) {
    try {
      const rows = await getCollection('stats_daily')
        .aggregate([
          { $match: { guild_id: guildId, day: { $in: keys } } },
          {
            $group: {
              _id: '$user_id',
              messages: { $sum: '$messages' },
              voice_seconds: { $sum: '$voice_seconds' },
            },
          },
          { $sort: { [sortField]: -1 } },
          { $limit: limit },
        ])
        .toArray();
      return rows.map((row) => ({ user_id: row._id, messages: row.messages, voice_seconds: row.voice_seconds }));
    } catch {
      /* bellek */
    }
  }

  const byUser = new Map();
  for (const entry of MEM.daily.values()) {
    if (entry.guild_id !== guildId || !keys.includes(entry.day)) continue;
    const agg = byUser.get(entry.user_id) ?? { user_id: entry.user_id, messages: 0, voice_seconds: 0 };
    agg.messages += entry.messages;
    agg.voice_seconds += entry.voice_seconds;
    byUser.set(entry.user_id, agg);
  }
  return [...byUser.values()].sort((a, b) => b[sortField] - a[sortField]).slice(0, limit);
}
