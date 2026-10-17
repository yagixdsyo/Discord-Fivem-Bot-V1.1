/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getCollection, isDbReady } from '../../../db/index.js';

const MAP_TTL_MS = 5 * 60 * 1000;
const MSG_LIMIT = 100;
const SNIPE_LIMIT = 10;

// ---------------------------------------------------------------------------
// Kanala esleme
// ---------------------------------------------------------------------------

const mapCache = new Map(); // guildId -> { at, byKey, byChannel }

export async function getLogChannelMap(guildId) {
  const hit = mapCache.get(guildId);
  if (hit && Date.now() - hit.at < MAP_TTL_MS) return hit;

  const byKey = new Map();
  const byChannel = new Map();
  if (isDbReady()) {
    try {
      const docs = await getCollection('channels_map').find({ guild_id: guildId }).toArray();
      for (const doc of docs) {
        if (!doc?.key || !doc?.channel_id) continue;
        if (!String(doc.key).startsWith('log_')) continue;
        byKey.set(doc.key, String(doc.channel_id));
        byChannel.set(String(doc.channel_id), doc.key);
      }
    } catch {
      /* yut */
    }
  }

  const entry = { at: Date.now(), byKey, byChannel };
  mapCache.set(guildId, entry);
  return entry;
}

export async function resolveLogChannelId(guildId, key) {
  const map = await getLogChannelMap(guildId);
  return map.byKey.get(key) ?? null;
}

export async function logKeyForChannel(guildId, channelId) {
  const map = await getLogChannelMap(guildId);
  return map.byChannel.get(String(channelId)) ?? null;
}

export function invalidateLogChannelMap(guildId) {
  if (guildId) mapCache.delete(guildId);
  else mapCache.clear();
}

// ---------------------------------------------------------------------------
// Mesaj onbellegi + snipe
// ---------------------------------------------------------------------------

const messageCache = new Map(); // channelId -> dizi (en eski ilk)
const snipeCache = new Map(); // channelId -> dizi (en yeni ilk)

function toCached(message) {
  return {
    id: message.id,
    channelId: message.channelId,
    authorId: message.author?.id ?? null,
    authorTag: message.author?.username ?? message.author?.tag ?? null,
    content: message.content ?? '',
    at: message.createdTimestamp ?? Date.now(),
    hadAttachments: Boolean(message.attachments?.size),
  };
}

/** Yeni/guncellenen mesaji onbellege alir (ayni id varsa gunceller). */
export function rememberMessage(message) {
  if (!message?.guildId || !message.channelId || !message.id) return;
  const arr = messageCache.get(message.channelId) ?? [];
  const filtered = arr.filter((m) => m.id !== message.id);
  filtered.push(toCached(message));
  if (filtered.length > MSG_LIMIT) filtered.splice(0, filtered.length - MSG_LIMIT);
  messageCache.set(message.channelId, filtered);
}

export function getCachedMessage(channelId, id) {
  const arr = messageCache.get(channelId);
  if (!arr) return null;
  return arr.find((m) => m.id === id) ?? null;
}

export function forgetMessage(channelId, id) {
  const arr = messageCache.get(channelId);
  if (!arr) return;
  const index = arr.findIndex((m) => m.id === id);
  if (index >= 0) arr.splice(index, 1);
}

/** Silinen mesaji snipe onbellegine ekler. */
export function pushSnipe(channelId, entry) {
  if (!channelId || !entry) return;
  const arr = snipeCache.get(channelId) ?? [];
  arr.unshift(entry);
  if (arr.length > SNIPE_LIMIT) arr.length = SNIPE_LIMIT;
  snipeCache.set(channelId, arr);
}

/** Son silinen mesajlari doner (index 0 = en son). */
export function getSnipe(channelId, count = 1) {
  return (snipeCache.get(channelId) ?? []).slice(0, count);
}

/** Toplu silme transcript'i icin onbellekten mesaj toplar. */
export function collectCachedMessages(channelId, ids) {
  return ids
    .map((id) => getCachedMessage(channelId, id))
    .filter(Boolean)
    .sort((a, b) => a.at - b.at);
}

// ---------------------------------------------------------------------------
// Davet onbellegi
// ---------------------------------------------------------------------------

const inviteCache = new Map(); // guildId -> Map<code, {uses, inviterId}>

export async function refreshInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    const map = new Map();
    for (const invite of invites.values()) {
      map.set(invite.code, { uses: invite.uses ?? 0, inviterId: invite.inviterId ?? null });
    }
    inviteCache.set(guild.id, map);
    return map;
  } catch {
    return inviteCache.get(guild.id) ?? new Map();
  }
}

/** Uye katildiginda once/sonra farkindan kullanilan daveti bulur. */
export function diffInvites(guildId, after) {
  const before = inviteCache.get(guildId) ?? new Map();
  let used = null;
  for (const [code, data] of after) {
    const prev = before.get(code)?.uses ?? 0;
    if (data.uses > prev) {
      used = { code, uses: data.uses, delta: data.uses - prev, inviterId: data.inviterId ?? null };
      break;
    }
  }
  inviteCache.set(guildId, after);
  return used;
}

export function trackInvite(guildId, code, data) {
  const map = inviteCache.get(guildId) ?? new Map();
  map.set(code, data);
  inviteCache.set(guildId, map);
}

export function trackInviteDelete(guildId, code) {
  const map = inviteCache.get(guildId);
  if (map) map.delete(code);
}
