/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../db/index.js';

const FLUSH_INTERVAL_MS = 15_000;
const MAX_BUFFER = 100;

let buffer = [];
let flushTimer = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushUsage().catch(() => {});
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref?.();
}

/** Komut calismasi kaydini tampona ekler (senkron, asla firlatmaz). */
export function recordCommandUsage({ guildId = null, command, ok = true } = {}) {
  if (!command || !isDbReady()) return;
  buffer.push({ guild_id: guildId ?? null, command, ok: Boolean(ok), at: new Date() });
  if (buffer.length >= MAX_BUFFER) {
    flushUsage().catch(() => {});
  } else {
    scheduleFlush();
  }
}

/** Tamponu DB'ye bosaltir. */
export async function flushUsage() {
  if (buffer.length === 0) return 0;
  if (!isDbReady()) {
    buffer = [];
    return 0;
  }
  const batch = buffer.splice(0, buffer.length);
  try {
    await getCollection('command_usage').insertMany(batch, { ordered: false });
    return batch.length;
  } catch {
    return 0; // yazilamayan kayitlar atilir (istatistik kritik degil)
  }
}

/** Kapanista cagrilir. */
export async function stopUsageStats() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  return flushUsage();
}

const WINDOWS = [
  ['24s', 24 * 60 * 60 * 1000],
  ['7g', 7 * 24 * 60 * 60 * 1000],
  ['30g', 30 * 24 * 60 * 60 * 1000],
];

async function windowStats(collection, since) {
  const match = { at: { $gte: since } };
  const [total, errorCount, top, topGuilds] = await Promise.all([
    collection.countDocuments(match),
    collection.countDocuments({ ...match, ok: false }),
    collection
      .aggregate([{ $match: match }, { $group: { _id: '$command', adet: { $sum: 1 } } }, { $sort: { adet: -1 } }, { $limit: 5 }])
      .toArray(),
    collection
      .aggregate([
        { $match: match },
        { $group: { _id: '$guild_id', adet: { $sum: 1 } } },
        { $sort: { adet: -1 } },
        { $limit: 5 },
      ])
      .toArray(),
  ]);
  return {
    total,
    errorCount,
    errorRate: total > 0 ? errorCount / total : 0,
    top: top.map((r) => ({ command: r._id, count: r.adet })),
    topGuilds: topGuilds.map((r) => ({ guildId: r._id, count: r.adet })),
  };
}

/**
 * Tum pencereler icin rapor uretir.
 * @returns {Promise<{ok: boolean, windows: Record<string, object>}>}
 */
export async function usageReport() {
  if (!isDbReady()) return { ok: false, windows: {} };
  try {
    const collection = getCollection('command_usage');
    const now = Date.now();
    const windows = {};
    for (const [label, ms] of WINDOWS) {
      windows[label] = await windowStats(collection, new Date(now - ms));
    }
    return { ok: true, windows };
  } catch {
    return { ok: false, windows: {} };
  }
}

/** Test/temizlik icin tampon durumu. */
export function usageBufferSize() {
  return buffer.length;
}
