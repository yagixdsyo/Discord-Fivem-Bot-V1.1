/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { randomBytes } from 'node:crypto';
import { getCollection, isDbReady } from '../../../db/index.js';

const MEM_CAP = 300;
const memByGuild = new Map();
let seq = 0;

export function makeIncidentId() {
  seq = (seq + 1) % 0xffff;
  return `gi-${Date.now().toString(36)}-${seq.toString(36)}-${randomBytes(2).toString('hex')}`;
}

/** Sayi dizisinden istatistik (saf fonksiyon; test edilebilir). */
export function computeStats(values) {
  const sorted = (values ?? []).map(Number).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return { count: 0, median: null, p90: null, p99: null, min: null, max: null };
  const pick = (p) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
  return {
    count: sorted.length,
    median: pick(0.5),
    p90: pick(0.9),
    p99: pick(0.99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/**
 * Olay kaydi olusturur.
 * @returns {Promise<object>} kayit dokumani (id dahil)
 */
export async function recordIncident({
  guildId,
  moduleKey,
  type,
  actorId = null,
  actorTag = null,
  target = null,
  action = null,
  safe = false,
  responseMs = null,
  restored = false,
  dryRun = false,
  description = null,
  payload = null,
}) {
  const doc = {
    incident_id: makeIncidentId(),
    guild_id: guildId,
    module: moduleKey,
    type,
    actor_id: actorId,
    actor_tag: actorTag,
    target,
    action,
    safe: Boolean(safe),
    response_ms: Number.isFinite(responseMs) ? Math.round(responseMs) : null,
    restored: Boolean(restored),
    dry_run: Boolean(dryRun),
    description,
    payload: payload ?? null,
    undone: false,
    at: new Date(),
  };

  const arr = memByGuild.get(guildId) ?? [];
  arr.unshift(doc);
  if (arr.length > MEM_CAP) arr.length = MEM_CAP;
  memByGuild.set(guildId, arr);

  if (isDbReady()) {
    try {
      await getCollection('guard_incidents').insertOne({ ...doc, created_at: doc.at });
    } catch {
      /* bellek kopyasi yeter */
    }
  }
  return doc;
}

function fromMemory(guildId, limit, predicate = null) {
  const arr = memByGuild.get(guildId) ?? [];
  const filtered = predicate ? arr.filter(predicate) : arr;
  return filtered.slice(0, limit);
}

export async function listRecentIncidents(guildId, limit = 10) {
  if (isDbReady()) {
    try {
      const docs = await getCollection('guard_incidents')
        .find({ guild_id: guildId })
        .sort({ at: -1 })
        .limit(limit)
        .toArray();
      if (docs.length > 0) return docs;
    } catch {
      /* bellek */
    }
  }
  return fromMemory(guildId, limit);
}

export async function findIncident(guildId, incidentId) {
  if (isDbReady()) {
    try {
      const doc = await getCollection('guard_incidents').findOne({ guild_id: guildId, incident_id: incidentId });
      if (doc) return doc;
    } catch {
      /* bellek */
    }
  }
  return fromMemory(guildId, 1, (d) => d.incident_id === incidentId)[0] ?? null;
}

export async function markIncidentUndone(guildId, incidentId) {
  const arr = memByGuild.get(guildId) ?? [];
  const local = arr.find((d) => d.incident_id === incidentId);
  if (local) local.undone = true;
  if (isDbReady()) {
    try {
      await getCollection('guard_incidents').updateOne(
        { guild_id: guildId, incident_id: incidentId },
        { $set: { undone: true, undone_at: new Date() } },
      );
    } catch {
      /* yut */
    }
  }
}

/**
 * /guard-performans icin ozet.
 * @returns {Promise<{stats: object, total: number, safeCount: number, undoneCount: number, byModule: Array<{module: string, count: number}>}>}
 */
export async function performanceStats(guildId, { days = 7, limit = 500 } = {}) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  let docs = [];
  if (isDbReady()) {
    try {
      docs = await getCollection('guard_incidents')
        .find({ guild_id: guildId, at: { $gte: since } })
        .sort({ at: -1 })
        .limit(limit)
        .toArray();
    } catch {
      docs = [];
    }
  }
  if (docs.length === 0) {
    docs = fromMemory(guildId, limit).filter((d) => new Date(d.at).getTime() >= since.getTime());
  }

  const punished = docs.filter((d) => !d.safe && !d.dry_run && d.action && d.action !== 'loglandi' && d.action !== 'esik_alti' && d.action !== 'cozulemedi');
  const byModule = new Map();
  for (const doc of docs) {
    byModule.set(doc.module, (byModule.get(doc.module) ?? 0) + 1);
  }

  return {
    stats: computeStats(punished.map((d) => d.response_ms)),
    total: docs.length,
    safeCount: docs.filter((d) => d.safe).length,
    undoneCount: docs.filter((d) => d.undone).length,
    byModule: [...byModule.entries()]
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function clearIncidentMemory() {
  memByGuild.clear();
}
