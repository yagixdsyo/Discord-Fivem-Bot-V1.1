/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ChannelType } from 'discord.js';
import { getCollection, isDbReady } from '../../../db/index.js';
import { getLogger } from '../../../core/logger.js';

const MEMBER_REQUEUE_DELAY_MS = 120;
const MEMBER_REQUEUE_CAP = 300;

// ---------------------------------------------------------------------------
// Snapshot uretimi (olay aninda)
// ---------------------------------------------------------------------------

export function roleSnapshot(role, { withMembers = true } = {}) {
  const memberIds = [];
  if (withMembers && role?.members) {
    try {
      for (const id of role.members.keys()) {
        memberIds.push(id);
        if (memberIds.length >= MEMBER_REQUEUE_CAP) break;
      }
    } catch {
      /* uye listesi alinamadi */
    }
  }
  return {
    id: role.id,
    name: role.name,
    color: role.color ?? 0,
    hoist: Boolean(role.hoist),
    mentionable: Boolean(role.mentionable),
    permissions: String(role.permissions?.bitfield ?? 0n),
    position: role.position ?? 0,
    managed: Boolean(role.managed),
    memberIds,
  };
}

function snapshotOverwrites(channel) {
  const out = [];
  const cache = channel?.permissionOverwrites?.cache;
  if (!cache) return out;
  for (const overwrite of cache.values()) {
    out.push({
      id: overwrite.id,
      type: overwrite.type,
      allow: String(overwrite.allow?.bitfield ?? 0n),
      deny: String(overwrite.deny?.bitfield ?? 0n),
    });
  }
  return out;
}

export function channelSnapshot(channel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId ?? null,
    position: channel.position ?? 0,
    topic: channel.topic ?? null,
    nsfw: Boolean(channel.nsfw),
    rateLimitPerUser: channel.rateLimitPerUser ?? 0,
    userLimit: channel.userLimit ?? 0,
    bitrate: channel.bitrate ?? null,
    overwrites: snapshotOverwrites(channel),
  };
}

export function emojiSnapshot(emoji) {
  return {
    id: emoji.id,
    name: emoji.name,
    animated: Boolean(emoji.animated),
    url: emoji.imageURL?.({ size: 128 }) ?? emoji.url ?? null,
  };
}

export function stickerSnapshot(sticker) {
  return {
    id: sticker.id,
    name: sticker.name,
    tags: sticker.tags ?? null,
    url: sticker.url ?? null,
  };
}

// ---------------------------------------------------------------------------
// Geri kurma
// ---------------------------------------------------------------------------

function mapId(id, idMap) {
  if (!id) return id;
  return idMap?.get?.(id) ?? id;
}

function filterOverwrites(overwrites, guild, idMap) {
  return (overwrites ?? []).filter((entry) => {
    const id = mapId(entry.id, idMap);
    if (id === guild.id) return true;
    if (guild.roles.cache.has(id)) return true;
    if (guild.channels.cache.has(id)) return true;
    return false;
  });
}

/** Silinen rolu izinleri, rengi, sirasi ve (mumkunse) uyeleriyle geri kurar. */
export async function restoreRole(guild, snapshot, { reason = 'Guard: rol geri kuruldu', idMap = new Map() } = {}) {
  const role = await guild.roles.create({
    name: snapshot.name,
    color: snapshot.color ?? 0,
    hoist: Boolean(snapshot.hoist),
    mentionable: Boolean(snapshot.mentionable),
    permissions: BigInt(snapshot.permissions ?? '0'),
    reason,
  });

  idMap.set(snapshot.id, role.id);

  try {
    const top = guild.members.me?.roles?.highest?.position ?? 1;
    const position = Math.min(Math.max(0, snapshot.position ?? role.position), Math.max(0, top - 1));
    await role.setPosition(position, { reason });
  } catch {
    /* siralama hatasi kritik degil */
  }

  if (Array.isArray(snapshot.memberIds) && snapshot.memberIds.length > 0) {
    // Kuyruklu dagitim (yaniti bloklamaz)
    requeueRoleMembers(guild, role.id, snapshot.memberIds).catch(() => {});
  }

  return role;
}

/** Rol uyelerini kuyruklu sekilde yeniden dagitir. */
export async function requeueRoleMembers(guild, roleId, memberIds) {
  let restored = 0;
  for (const memberId of memberIds.slice(0, MEMBER_REQUEUE_CAP)) {
    try {
      const member = guild.members.cache.get(memberId) ?? (await guild.members.fetch(memberId));
      await member.roles.add(roleId, 'Guard: rol dagitimi geri yuklendi');
      restored += 1;
    } catch {
      /* tek uye hatasi akisi durdurmaz */
    }
    await new Promise((resolve) => setTimeout(resolve, MEMBER_REQUEUE_DELAY_MS));
  }
  getLogger().debug({ guildId: guild.id, roleId, restored }, 'Guard rol dagitimi tamamlandi');
  return restored;
}

/** Silinen kanali izin agi, konum ve ayarlariyla geri kurar. */
export async function restoreChannel(guild, snapshot, { reason = 'Guard: kanal geri kuruldu', idMap = new Map() } = {}) {
  const parentId = mapId(snapshot.parentId, idMap);
  const parent = parentId ? guild.channels.cache.get(parentId) ?? null : null;

  const options = {
    name: snapshot.name,
    type: snapshot.type ?? ChannelType.GuildText,
    reason,
    permissionOverwrites: filterOverwrites(snapshot.overwrites, guild, idMap).map((entry) => ({
      id: mapId(entry.id, idMap),
      type: entry.type,
      allow: BigInt(entry.allow),
      deny: BigInt(entry.deny),
    })),
  };
  if (parent) options.parent = parent;
  if (snapshot.topic) options.topic = snapshot.topic;
  if (snapshot.type === ChannelType.GuildVoice) {
    if (snapshot.bitrate) options.bitrate = Math.min(snapshot.bitrate, 96000);
    if (snapshot.userLimit) options.userLimit = snapshot.userLimit;
  } else {
    options.nsfw = Boolean(snapshot.nsfw);
    options.rateLimitPerUser = snapshot.rateLimitPerUser ?? 0;
  }

  const channel = await guild.channels.create(options);
  idMap.set(snapshot.id, channel.id);

  try {
    await channel.setPosition(snapshot.position ?? channel.position, { reason });
  } catch {
    /* siralama hatasi kritik degil */
  }

  return channel;
}

/** Silinen emojiyi geri kurar (gorsel URL'sinden indirip yukler). */
export async function restoreEmoji(guild, snapshot, { reason = 'Guard: emoji geri kuruldu' } = {}) {
  if (!snapshot?.url || !snapshot?.name) return null;
  try {
    const response = await fetch(snapshot.url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const emoji = await guild.emojis.create({
      attachment: buffer,
      name: snapshot.name,
      reason,
    });
    return emoji;
  } catch {
    return null;
  }
}

/** Silinen sticker'i geri kurar (en iyi caba). */
export async function restoreSticker(guild, snapshot, { reason = 'Guard: sticker geri kuruldu' } = {}) {
  if (!snapshot?.url || !snapshot?.name) return null;
  try {
    const response = await fetch(snapshot.url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const sticker = await guild.stickers.create({
      file: buffer,
      name: snapshot.name,
      tags: snapshot.tags ?? 'guard',
      reason,
    });
    return sticker;
  } catch {
    return null;
  }
}

/** Kanal izinlerini eski haline dondurur (channelUpdate korumasi). */
export async function revertChannelOverwrites(channel, snapshot) {
  try {
    const list = filterOverwrites(snapshot.overwrites, channel.guild, null).map((entry) => ({
      id: entry.id,
      type: entry.type,
      allow: BigInt(entry.allow),
      deny: BigInt(entry.deny),
    }));
    await channel.permissionOverwrites.set(list, 'Guard: izinler geri alindi');
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// ID esleme guncellemesi
// ---------------------------------------------------------------------------

const REMAP_FIELDS = Object.freeze({
  channels_map: ['channel_id', 'category_id'],
  roles_map: ['role_id'],
  panel_messages: ['channel_id'],
  guard_protected_roles: ['role_id'],
});

/**
 * Eski ID -> yeni ID eslemesini bot kayitlarina isler.
 * @param {string} guildId
 * @param {Map<string, string>} idMap
 * @returns {Promise<number>} guncellenen dokuman sayisi
 */
export async function remapMappedIds(guildId, idMap) {
  if (!isDbReady() || !idMap || idMap.size === 0) return 0;
  let updated = 0;

  for (const [collection, fields] of Object.entries(REMAP_FIELDS)) {
    let docs = [];
    try {
      docs = await getCollection(collection).find({ guild_id: guildId }).toArray();
    } catch {
      continue;
    }
    for (const doc of docs) {
      const set = {};
      for (const field of fields) {
        const value = doc[field];
        if (value && idMap.has(String(value))) set[field] = idMap.get(String(value));
      }
      if (Object.keys(set).length === 0) continue;
      try {
        await getCollection(collection).updateOne({ _id: doc._id }, { $set: { ...set, updated_at: new Date().toISOString() } });
        updated += 1;
      } catch {
        /* yut */
      }
    }
  }

  return updated;
}
