/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { gzipSync } from 'node:zlib';
import { emitLog } from '../../logging/lib/emit.js';
import { saveBackup } from './store.js';

const KIND_LABELS = { manual: 'Manuel', auto: 'Otomatik', pre: 'Saldırı öncesi', permanent: 'Kalıcı' };

function channelData(channel) {
  const overwrites = [];
  const cache = channel.permissionOverwrites?.cache;
  if (cache) {
    for (const overwrite of cache.values()) {
      overwrites.push({
        id: overwrite.id,
        type: overwrite.type,
        allow: String(overwrite.allow?.bitfield ?? 0n),
        deny: String(overwrite.deny?.bitfield ?? 0n),
      });
    }
  }
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId ?? null,
    position: channel.position ?? 0,
    topic: channel.topic ?? null,
    nsfw: Boolean(channel.nsfw),
    rateLimitPerUser: channel.rateLimitPerUser ?? 0,
    bitrate: channel.bitrate ?? null,
    userLimit: channel.userLimit ?? 0,
    overwrites,
  };
}

/**
 * Sunucu verisini anlik goruntuden toplar (ag cagrisi yapmaz).
 */
export function collectGuildData(guild, { includeMemberRoles = false } = {}) {
  const roles = [];
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id) continue; // @everyone ayri alanda
    roles.push({
      id: role.id,
      name: role.name,
      color: role.color ?? 0,
      hoist: Boolean(role.hoist),
      mentionable: Boolean(role.mentionable),
      permissions: String(role.permissions?.bitfield ?? 0n),
      position: role.position ?? 0,
      managed: Boolean(role.managed),
      icon: role.icon ?? null,
    });
  }
  roles.sort((a, b) => a.position - b.position);

  const channels = [];
  for (const channel of guild.channels.cache.values()) {
    channels.push(channelData(channel));
  }
  channels.sort((a, b) => a.position - b.position);

  const emojis = [];
  for (const emojiItem of guild.emojis.cache.values()) {
    emojis.push({
      id: emojiItem.id,
      name: emojiItem.name,
      animated: Boolean(emojiItem.animated),
      url: emojiItem.imageURL?.({ size: 128 }) ?? emojiItem.url ?? null,
    });
  }

  const stickers = [];
  for (const sticker of guild.stickers.cache.values()) {
    stickers.push({ id: sticker.id, name: sticker.name, tags: sticker.tags ?? null, url: sticker.url ?? null });
  }

  const webhooks = [];
  // Webhook listesi kanal onbelleginden toplanir (token saklanmaz)
  for (const channel of guild.channels.cache.values()) {
    const hooks = channel.webhooks?.cache;
    if (!hooks) continue;
    for (const hook of hooks.values()) {
      webhooks.push({ id: hook.id, name: hook.name, channelId: channel.id });
    }
  }

  let memberRoles = null;
  if (includeMemberRoles) {
    memberRoles = {};
    for (const role of guild.roles.cache.values()) {
      if (role.id === guild.id) continue;
      try {
        const ids = [...role.members.keys()];
        if (ids.length > 0) memberRoles[role.id] = ids;
      } catch {
        /* uye listesi alinamadi */
      }
    }
  }

  return {
    version: 1,
    guild: {
      name: guild.name,
      verificationLevel: guild.verificationLevel ?? null,
      afkChannelId: guild.afkChannelId ?? null,
      afkTimeout: guild.afkTimeout ?? null,
      systemChannelId: guild.systemChannelId ?? null,
      rulesChannelId: guild.rulesChannelId ?? null,
      preferredLocale: guild.preferredLocale ?? null,
      everyonePermissions: String(guild.roles?.everyone?.permissions?.bitfield ?? 0n),
    },
    roles,
    channels,
    emojis,
    stickers,
    webhooks,
    memberRoles,
    counts: {
      roles: roles.length,
      channels: channels.length,
      categories: channels.filter((c) => c.type === 4).length,
      emojis: emojis.length,
      stickers: stickers.length,
      webhooks: webhooks.length,
    },
  };
}

/**
 * Backup alir.
 * @returns {Promise<{ok: boolean, kind: string, size: number, counts: object, createdAt: Date}>}
 */
export async function createBackup(guild, { kind = 'manual', label = null, includeMemberRoles = false, by = null } = {}) {
  const data = collectGuildData(guild, { includeMemberRoles });
  const json = JSON.stringify(data);
  const buffer = gzipSync(Buffer.from(json, 'utf8'));

  const doc = await saveBackup({
    guildId: guild.id,
    kind,
    label,
    dataBuffer: buffer,
    size: buffer.length,
    counts: data.counts,
  });

  await emitLog(guild, 'log_backup', {
    actor: by,
    lines: [
      `İşlem: **Backup alındı** (${KIND_LABELS[kind] ?? kind})`,
      `Boyut: **${(buffer.length / 1024).toFixed(1)} KB**`,
      `Rol: **${data.counts.roles}** • Kanal: **${data.counts.channels}** • Emoji: **${data.counts.emojis}**`,
    ],
  });

  return { ok: true, kind, size: doc.size, counts: data.counts, createdAt: doc.created_at };
}

/** Kayitli backup dokumanindan veriyi cozer. */
export async function parseBackupData(doc) {
  if (!doc?.data) return null;
  try {
    const { gunzipSync } = await import('node:zlib');
    const buffer = Buffer.isBuffer(doc.data) ? doc.data : Buffer.from(doc.data.buffer ?? doc.data);
    return JSON.parse(gunzipSync(buffer).toString('utf8'));
  } catch {
    return null;
  }
}
