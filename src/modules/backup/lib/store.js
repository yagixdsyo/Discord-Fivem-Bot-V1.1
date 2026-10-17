/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../../db/index.js';

const AUTO_KEEP = 5;
const PRE_KEEP = 3;
const MEM_CAP = 24;

const mem = []; // {guild_id, kind, label, size, counts, created_at, data}

function memTrim() {
  while (mem.length > MEM_CAP) mem.shift();
}

function memDocs(guildId, kind = null) {
  return mem.filter((doc) => doc.guild_id === guildId && (!kind || doc.kind === kind));
}

/**
 * Backup kaydeder ve saklama politikasini uygular.
 * @returns {Promise<{guild_id: string, kind: string, label: string|null, size: number, counts: object, created_at: Date}>}
 */
export async function saveBackup({ guildId, kind, label = null, dataBuffer, size, counts }) {
  const now = new Date();

  if (isDbReady()) {
    const collection = getCollection('backups');
    if (kind === 'manual') {
      await collection.deleteMany({ guild_id: guildId, kind: 'manual' });
    } else if (kind === 'auto' || kind === 'pre') {
      const keep = kind === 'auto' ? AUTO_KEEP : PRE_KEEP;
      const old = await collection
        .find({ guild_id: guildId, kind })
        .sort({ created_at: -1 })
        .skip(keep - 1)
        .toArray();
      if (old.length > 0) {
        await collection.deleteMany({ _id: { $in: old.map((doc) => doc._id) } });
      }
    }
    await collection.insertOne({
      guild_id: guildId,
      kind,
      label,
      size,
      counts,
      data: dataBuffer,
      created_at: now,
    });
  }

  for (const doc of memDocs(guildId, kind)) {
    if (kind === 'manual') {
      const index = mem.indexOf(doc);
      if (index >= 0) mem.splice(index, 1);
    }
  }
  mem.push({ guild_id: guildId, kind, label, size, counts, created_at: now, data: dataBuffer });
  // Bellek saklama politikasi
  for (const kindName of ['auto', 'pre']) {
    const keep = kindName === 'auto' ? AUTO_KEEP : PRE_KEEP;
    const docs = memDocs(guildId, kindName);
    if (docs.length > keep) {
      for (const doc of docs.slice(0, docs.length - keep)) {
        const index = mem.indexOf(doc);
        if (index >= 0) mem.splice(index, 1);
      }
    }
  }
  memTrim();

  return { guild_id: guildId, kind, label, size, counts, created_at: now };
}

/** En son backup dokumani (data dahil). */
export async function getLatestBackup(guildId, kind = null) {
  if (isDbReady()) {
    try {
      const query = { guild_id: guildId };
      if (kind) query.kind = kind;
      const doc = await getCollection('backups').find(query).sort({ created_at: -1 }).limit(1).next();
      if (doc) return doc;
    } catch {
      /* bellek */
    }
  }
  const docs = memDocs(guildId, kind);
  return docs.length > 0 ? docs[docs.length - 1] : null;
}

/** Liste (data olmadan). */
export async function listBackups(guildId, { limit = 20 } = {}) {
  if (isDbReady()) {
    try {
      const docs = await getCollection('backups')
        .find({ guild_id: guildId }, { projection: { data: 0 } })
        .sort({ created_at: -1 })
        .limit(limit)
        .toArray();
      if (docs.length > 0) return docs;
    } catch {
      /* bellek */
    }
  }
  return memDocs(guildId)
    .slice()
    .reverse()
    .slice(0, limit)
    .map((doc) => ({ ...doc, data: undefined }));
}

/**
 * Backup siler.
 * @param {{kinds?: string[]}} [opts] varsayilan: kalici haric tumu
 * @returns {Promise<number>} silinen adet
 */
export async function deleteBackups(guildId, { kinds = ['manual', 'auto', 'pre'] } = {}) {
  let deleted = 0;
  if (isDbReady()) {
    try {
      const result = await getCollection('backups').deleteMany({ guild_id: guildId, kind: { $in: kinds } });
      deleted += result.deletedCount ?? 0;
    } catch {
      /* bellek */
    }
  }
  for (const doc of [...memDocs(guildId)]) {
    if (!kinds.includes(doc.kind)) continue;
    const index = mem.indexOf(doc);
    if (index >= 0) {
      mem.splice(index, 1);
      deleted += 1;
    }
  }
  return deleted;
}

export function clearBackupMemory() {
  mem.length = 0;
}
