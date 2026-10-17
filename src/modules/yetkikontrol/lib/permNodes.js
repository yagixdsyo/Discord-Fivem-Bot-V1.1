/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../../db/index.js';
import { getLogger } from '../../../core/logger.js';
import { getRedis, isRedisReady } from '../../../core/redis.js';

const COLL = 'perm_nodes';

export function permNodesDbReady() {
  return isDbReady();
}

async function invalidate(guildId, node) {
  if (!isRedisReady()) return;
  try {
    await getRedis().del(`perm:${guildId}:${node}`);
  } catch (error) {
    getLogger().warn({ err: error?.message }, 'perm dugumu onbellegi temizlenemedi');
  }
}

export async function listPermNodes(guildId) {
  if (!isDbReady()) return [];
  try {
    return await getCollection(COLL).find({ guild_id: guildId }).toArray();
  } catch {
    return [];
  }
}

export async function getNode(guildId, node) {
  if (!isDbReady()) return null;
  try {
    return await getCollection(COLL).findOne({ guild_id: guildId, node });
  } catch {
    return null;
  }
}

async function ensure(guildId, node) {
  const existing = await getNode(guildId, node);
  if (existing) return existing;
  return { guild_id: guildId, node, role_ids: [], user_ids: [] };
}

async function persist(guildId, node, roleIds, userIds) {
  await getCollection(COLL).updateOne(
    { guild_id: guildId, node },
    { $set: { guild_id: guildId, node, role_ids: roleIds, user_ids: userIds, updated_at: new Date().toISOString() } },
    { upsert: true },
  );
  await invalidate(guildId, node);
}

/** Rol/kisi baglar (mevcutlar korunur). */
export async function bindPermNode({ guildId, node, roleIds = [], userIds = [] }) {
  if (!isDbReady()) return { ok: false, error: 'db' };
  const doc = await ensure(guildId, node);
  const roles = [...new Set([...(doc.role_ids ?? []), ...roleIds])];
  const users = [...new Set([...(doc.user_ids ?? []), ...userIds])];
  await persist(guildId, node, roles, users);
  return { ok: true, doc: { guild_id: guildId, node, role_ids: roles, user_ids: users } };
}

/** Rol/kisi bagini kaldirir. */
export async function unbindPermNode({ guildId, node, roleIds = [], userIds = [] }) {
  if (!isDbReady()) return { ok: false, error: 'db' };
  const doc = await getNode(guildId, node);
  if (!doc) return { ok: false, error: 'yok' };
  const roles = (doc.role_ids ?? []).filter((x) => !roleIds.includes(x));
  const users = (doc.user_ids ?? []).filter((x) => !userIds.includes(x));
  const removed = (doc.role_ids ?? []).length + (doc.user_ids ?? []).length - (roles.length + users.length);
  if (removed <= 0) return { ok: false, error: 'bagli_degil' };
  await persist(guildId, node, roles, users);
  return { ok: true, doc: { guild_id: guildId, node, role_ids: roles, user_ids: users } };
}

/** Dugumu ve tum baglantilarini siler. */
export async function clearPermNode(guildId, node) {
  if (!isDbReady()) return { ok: false, error: 'db' };
  const doc = await getNode(guildId, node);
  if (!doc) return { ok: false, error: 'yok' };
  await getCollection(COLL).deleteOne({ guild_id: guildId, node });
  await invalidate(guildId, node);
  return { ok: true };
}
