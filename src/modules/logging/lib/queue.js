/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getLogger } from '../../../core/logger.js';
import { getRedis, isRedisReady } from '../../../core/redis.js';
import { batchLogPayload, singleLogPayload } from './format.js';
import { storeSentLog } from './protection.js';

const RATE_MS = 1100;
const BATCH_MAX = 5;
const QUEUE_CAP = 1000;
const IDLE_LIMIT = Math.ceil((5 * 60_000) / RATE_MS);
const MAX_ATTEMPTS = 3;

const workers = new Map(); // channelId -> { timer, idle, running }
const memoryQueues = new Map(); // channelId -> dizi

let client = null;

export function setQueueClient(value) {
  client = value;
}

function queueKey(channelId) {
  return `lq:${channelId}`;
}

/** Dosya eklerini JSON'a cevrilebilir hale getirir (AttachmentBuilder -> base64). */
function serializeEntry(entry) {
  if (!entry?.files?.length) return { ...entry };
  const files = entry.files.map((file) => ({
    name: file.name ?? 'ek.bin',
    data: file.attachment ? Buffer.from(file.attachment).toString('base64') : null,
  }));
  return { ...entry, files };
}

/** JSON'dan geri donen dosya tanimlarini AttachmentBuilder'a cevirir. */
export async function hydrateFiles(entry) {
  if (!entry?.files?.length) return entry;
  const files = [];
  for (const file of entry.files) {
    if (file?.attachment) {
      files.push(file);
      continue;
    }
    if (!file?.data) continue;
    try {
      const { AttachmentBuilder } = await import('discord.js');
      files.push(new AttachmentBuilder(Buffer.from(file.data, 'base64'), { name: file.name }));
    } catch {
      /* yut */
    }
  }
  return { ...entry, files };
}

/** Kuyruga log kaydi ekler ve isciyi baslatir. */
export async function enqueueLog(entry) {
  if (!entry?.channelId) return false;
  const record = {
    channelId: String(entry.channelId),
    guildId: entry.guildId ?? null,
    key: entry.key,
    entry: serializeEntry(entry.entry ?? {}),
    at: entry.at ?? Date.now(),
  };
  const payload = JSON.stringify(record);

  let pushed = false;
  if (isRedisReady()) {
    try {
      const redis = getRedis();
      await redis.rpush(queueKey(record.channelId), payload);
      await redis.ltrim(queueKey(record.channelId), -QUEUE_CAP, -1);
      pushed = true;
    } catch {
      pushed = false;
    }
  }
  if (!pushed) {
    const arr = memoryQueues.get(record.channelId) ?? [];
    arr.push(record);
    if (arr.length > QUEUE_CAP) arr.splice(0, arr.length - QUEUE_CAP);
    memoryQueues.set(record.channelId, arr);
  }

  ensureWorker(record.channelId);
  return true;
}

async function pull(channelId, max) {
  const out = [];

  if (isRedisReady()) {
    try {
      const redis = getRedis();
      while (out.length < max) {
        const raw = await redis.lpop(queueKey(channelId));
        if (!raw) break;
        out.push(JSON.parse(raw));
      }
    } catch {
      /* yut */
    }
  }

  const mem = memoryQueues.get(channelId);
  if (out.length < max && mem && mem.length > 0) {
    out.push(...mem.splice(0, max - out.length));
  }
  return out;
}

async function requeueFront(channelId, items) {
  if (items.length === 0) return;
  if (isRedisReady()) {
    try {
      const redis = getRedis();
      const payloads = items.map((item) => JSON.stringify(item));
      await redis.lpush(queueKey(channelId), ...payloads.reverse());
      return;
    } catch {
      /* bellek yoluna dus */
    }
  }
  const mem = memoryQueues.get(channelId) ?? [];
  mem.unshift(...items);
  memoryQueues.set(channelId, mem);
}

export function ensureWorker(channelId) {
  if (!client || !channelId) return;
  const existing = workers.get(channelId);
  if (existing) {
    existing.idle = 0;
    return;
  }
  const worker = { idle: 0, running: false, timer: null };
  worker.timer = setInterval(() => {
    tick(channelId).catch(() => {});
  }, RATE_MS);
  worker.timer.unref?.();
  workers.set(channelId, worker);
}

export function stopWorker(channelId) {
  const worker = workers.get(channelId);
  if (!worker) return;
  clearInterval(worker.timer);
  workers.delete(channelId);
}

export function stopAllWorkers() {
  for (const channelId of [...workers.keys()]) stopWorker(channelId);
}

async function tick(channelId) {
  const worker = workers.get(channelId);
  if (!worker || worker.running) return;
  worker.running = true;
  try {
    const items = await pull(channelId, BATCH_MAX);
    if (items.length === 0) {
      worker.idle += 1;
      if (worker.idle > IDLE_LIMIT) stopWorker(channelId);
      return;
    }
    worker.idle = 0;
    await deliver(channelId, items);
  } finally {
    worker.running = false;
  }
}

async function resolveChannel(channelId) {
  if (!client) return null;
  try {
    return client.channels.cache.get(channelId) ?? (await client.channels.fetch(channelId));
  } catch {
    return null;
  }
}

async function deliver(channelId, items) {
  const channel = await resolveChannel(channelId);
  if (!channel || typeof channel.send !== 'function') {
    getLogger().warn({ channelId }, 'Log kanali bulunamadi; kayitlar dusuruldu');
    stopWorker(channelId);
    return;
  }

  const hydrated = [];
  for (const item of items) {
    hydrated.push({ ...item, entry: await hydrateFiles(item.entry) });
  }

  const guildName = channel.guild?.name ?? '';
  const payload =
    hydrated.length === 1
      ? singleLogPayload({ key: hydrated[0].key, entry: hydrated[0].entry, guildName })
      : batchLogPayload({ items: hydrated, guildName });

  try {
    const sent = await channel.send(payload);
    storeSentLog({
      guildId: channel.guildId ?? channel.guild?.id ?? null,
      channelId,
      messageId: sent.id,
      items: items.map((item, index) => ({ ...item, entry: hydrated[index].entry })),
    }).catch(() => {});
  } catch (err) {
    const attempts = Math.max(...items.map((item) => item.__attempts ?? 0), 0) + 1;
    if (attempts < MAX_ATTEMPTS) {
      await requeueFront(
        channelId,
        items.map((item) => ({ ...item, __attempts: attempts })),
      );
    } else {
      getLogger().warn(
        { channelId, err: err?.message ?? String(err) },
        'Log gonderilemedi; kayitlar dusuruldu',
      );
    }
  }
}

/**
 * Bot yeniden basladiktan sonra Redis'te bekleyen kuyruklari canlandirir.
 * @returns {Promise<number>} yeniden baslatilan isci sayisi
 */
export async function scanQueuedChannels() {
  if (!client || !isRedisReady()) return 0;
  let count = 0;
  try {
    const redis = getRedis();
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'lq:*', 'COUNT', 200);
      cursor = next;
      for (const key of keys) {
        const channelId = key.slice(3);
        if (!channelId) continue;
        if (client.channels.cache.has(channelId)) {
          ensureWorker(channelId);
          count += 1;
        }
      }
    } while (cursor !== '0');
  } catch {
    /* yut */
  }
  return count;
}

/** Test/kapama icin: bellek kuyrugunu temizler. */
export function clearMemoryQueues() {
  memoryQueues.clear();
}

/** Kanal kuyrugundaki bekleyen kayit sayisi (bellek + Redis). */
export async function getQueueLength(channelId) {
  let total = memoryQueues.get(String(channelId))?.length ?? 0;
  if (isRedisReady()) {
    try {
      total += await getRedis().llen(queueKey(String(channelId)));
    } catch {
      /* yut */
    }
  }
  return total;
}

export const QUEUE_CONFIG = Object.freeze({ RATE_MS, BATCH_MAX, QUEUE_CAP, MAX_ATTEMPTS });
