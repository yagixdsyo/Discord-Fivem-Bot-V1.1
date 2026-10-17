/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { createDbStore } from '../../setup/lib/store.js';

const store = createDbStore();
const cache = new Map(); // `${guildId}:${kind}` -> {at, map}
const TTL_MS = 60_000;

async function loadMap(guildId, kind) {
  const key = `${guildId}:${kind}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.map;

  const map = new Map();
  try {
    const docs = await store.getMap(kind, guildId);
    for (const doc of docs) {
      const id = kind === 'roles_map' ? doc.role_id : doc.channel_id;
      if (doc.key && id) map.set(doc.key, id);
    }
  } catch {
    /* yut */
  }
  cache.set(key, { at: Date.now(), map });
  return map;
}

export async function getChannelId(guildId, key) {
  return (await loadMap(guildId, 'channels_map')).get(key) ?? null;
}

export async function getRoleId(guildId, key) {
  return (await loadMap(guildId, 'roles_map')).get(key) ?? null;
}

/** `key` ile haritadaki kanal nesnesini cozer (cache -> fetch). */
export async function resolveChannel(guild, key) {
  const id = await getChannelId(guild.id, key);
  if (!id) return null;
  try {
    return guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
  } catch {
    return null;
  }
}

/** `key` ile haritadaki rol nesnesini cozer. */
export async function resolveRole(guild, key) {
  const id = await getRoleId(guild.id, key);
  if (!id) return null;
  try {
    return guild.roles.cache.get(id) ?? (await guild.roles.fetch(id).catch(() => null));
  } catch {
    return null;
  }
}

/** Test izolasyonu. */
export function clearMapsCache() {
  cache.clear();
}
