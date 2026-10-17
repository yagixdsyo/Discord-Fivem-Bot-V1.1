/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../../db/index.js';

const MEMORY = new Map();
const COLLECTION = 'fun_scores';

function key(guildId, userId) { return `${guildId}:${userId}`; }

async function upsertEntry(guildId, userId, updater) {
  const dbReady = Boolean(isDbReady && isDbReady());
  const coll = dbReady ? getCollection(COLLECTION) : null;
  const existing = dbReady && coll
    ? await coll.findOne({ guild_id: guildId, user_id: userId }).catch(() => null)
    : { score: MEMORY.get(key(guildId, userId)) ?? 0 };
  const nextScore = updater(existing?.score ?? 0);
  MEMORY.set(key(guildId, userId), nextScore);
  if (dbReady && coll) {
    await coll.updateOne(
      { guild_id: guildId, user_id: userId },
      { $set: { score: nextScore, updated_at: new Date() }, $setOnInsert: { created_at: new Date() } },
      { upsert: true }
    );
  }
  return nextScore;
}

export async function getScore(guildId, userId) {
  if (isDbReady && isDbReady()) {
    const coll = getCollection(COLLECTION);
    const doc = await coll.findOne({ guild_id: guildId, user_id: userId }).catch(() => null);
    if (doc) {
      MEMORY.set(key(guildId, userId), doc.score);
      return doc.score;
    }
  }
  return MEMORY.get(key(guildId, userId)) ?? 0;
}

export async function addScore(guildId, userId, delta) {
  if (typeof delta !== 'number' || Number.isNaN(delta)) return getScore(guildId, userId);
  return upsertEntry(guildId, userId, (score) => score + delta);
}

export async function setScore(guildId, userId, value) {
  return upsertEntry(guildId, userId, () => value);
}

export async function transferScore(guildId, fromId, toId, amount) {
  const fromScore = await getScore(guildId, fromId);
  if (fromScore < amount) return false;
  await addScore(guildId, fromId, -amount);
  await addScore(guildId, toId, amount);
  return true;
}

export async function getTop(guildId, limit = 10) {
  if (isDbReady && isDbReady()) {
    const coll = getCollection(COLLECTION);
    const docs = await coll.find({ guild_id: guildId }).sort({ score: -1 }).limit(limit).toArray().catch(() => null);
    if (docs) {
      for (const doc of docs) MEMORY.set(key(guildId, doc.user_id), doc.score);
      return docs.map((doc, index) => ({ rank: index + 1, userId: doc.user_id, score: doc.score }));
    }
  }
  return [...MEMORY.keys()]
    .filter((k) => k.startsWith(`${guildId}:`))
    .map((k) => ({ userId: k.slice(guildId.length + 1), score: MEMORY.get(k) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x, i) => ({ rank: i + 1, ...x }));
}

export async function resetScores(guildId) {
  [...MEMORY.keys()].forEach((k) => { if (k.startsWith(`${guildId}:`)) MEMORY.delete(k); });
  if (isDbReady && isDbReady()) {
    const coll = getCollection(COLLECTION);
    await coll.deleteMany({ guild_id: guildId }).catch(() => {});
  }
  return true;
}