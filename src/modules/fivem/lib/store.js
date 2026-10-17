/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../../db/index.js';

const MEM = new Map(); // koleksiyon -> dizi (en yeni ilk)
const MEM_CAP = 5000;

export function clearFivemMemory() {
  MEM.clear();
}

function memList(name) {
  if (!MEM.has(name)) MEM.set(name, []);
  return MEM.get(name);
}

function cmp(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''));
}

function matches(doc, filter) {
  return Object.entries(filter ?? {}).every(([key, expected]) => {
    const value = doc[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$ne' in expected && value === expected.$ne) return false;
      if ('$in' in expected && !expected.$in.includes(value)) return false;
      if ('$lte' in expected && !(cmp(value, expected.$lte) <= 0)) return false;
      if ('$gte' in expected && !(cmp(value, expected.$gte) >= 0)) return false;
      if (!('$ne' in expected) && !('$in' in expected) && !('$lte' in expected) && !('$gte' in expected)) {
        return false;
      }
      return true;
    }
    return value === expected;
  });
}

export async function insertDoc(name, doc) {
  const full = { created_at: new Date().toISOString(), ...doc };
  if (isDbReady()) {
    await getCollection(name).insertOne({ ...full });
    return full;
  }
  const list = memList(name);
  list.unshift(full);
  if (list.length > MEM_CAP) list.length = MEM_CAP;
  return full;
}

export async function findDocs(name, filter = {}, { sort = null, limit = 200 } = {}) {
  if (isDbReady()) {
    try {
      let cursor = getCollection(name).find(filter);
      if (sort) cursor = cursor.sort(sort);
      if (limit) cursor = cursor.limit(limit);
      return await cursor.toArray();
    } catch {
      /* bellek */
    }
  }
  let list = memList(name).filter((doc) => matches(doc, filter));
  if (sort) {
    const [field, dir] = Object.entries(sort)[0] ?? [];
    if (field) list = [...list].sort((a, b) => cmp(a[field], b[field]) * (dir === -1 ? -1 : 1));
  }
  return limit ? list.slice(0, limit) : list;
}

export async function findOneDoc(name, filter = {}) {
  const rows = await findDocs(name, filter, { limit: 1 });
  return rows[0] ?? null;
}

export async function updateDoc(name, filter, patch) {
  if (isDbReady()) {
    try {
      const result = await getCollection(name).updateOne(filter, { $set: { ...patch, updated_at: new Date().toISOString() } });
      return result.matchedCount > 0;
    } catch {
      /* bellek */
    }
  }
  let changed = false;
  for (const doc of memList(name)) {
    if (matches(doc, filter)) {
      Object.assign(doc, patch, { updated_at: new Date().toISOString() });
      changed = true;
    }
  }
  return changed;
}

export async function deleteDocs(name, filter = {}) {
  if (isDbReady()) {
    try {
      const result = await getCollection(name).deleteMany(filter);
      return result.deletedCount ?? 0;
    } catch {
      /* bellek */
    }
  }
  const list = memList(name);
  const keep = list.filter((doc) => !matches(doc, filter));
  const removed = list.length - keep.length;
  MEM.set(name, keep);
  return removed;
}

export async function countDocs(name, filter = {}) {
  if (isDbReady()) {
    try {
      return await getCollection(name).countDocuments(filter);
    } catch {
      /* bellek */
    }
  }
  return memList(name).filter((doc) => matches(doc, filter)).length;
}
