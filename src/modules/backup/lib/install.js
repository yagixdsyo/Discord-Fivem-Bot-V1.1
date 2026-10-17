/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ChannelType } from 'discord.js';
import { remapMappedIds, requeueRoleMembers } from '../../guard/lib/restore.js';
import { invalidateLogChannelMap } from '../../logging/lib/cache.js';
import { CATEGORY_TYPE } from './plan.js';

function mapId(id, idMap) {
  if (!id) return id;
  return idMap.get(String(id)) ?? id;
}

function overwriteList(overwrites, guild, idMap) {
  const list = [];
  for (const entry of overwrites ?? []) {
    const mapped = mapId(entry.id, idMap);
    const exists = mapped === guild.id || guild.roles.cache.has(mapped) || guild.channels.cache.has(mapped);
    if (!exists) continue;
    list.push({ id: mapped, type: entry.type, allow: BigInt(entry.allow ?? 0), deny: BigInt(entry.deny ?? 0) });
  }
  return list;
}

function resolveParent(guild, data, channelData, idMap) {
  const mappedId = mapId(channelData.parentId, idMap);
  if (mappedId) {
    const direct = guild.channels.cache.get(mappedId);
    if (direct) return direct;
  }
  if (channelData.parentId) {
    const backupParent = (data.channels ?? []).find((channel) => channel.id === channelData.parentId);
    if (backupParent) {
      const byName = guild.channels.cache.find(
        (existing) => existing.type === CATEGORY_TYPE && existing.name === backupParent.name,
      );
      if (byName) return byName;
    }
  }
  return null;
}

/**
 * Plani uygular.
 * @returns {Promise<{ok: boolean, idMap: Map<string,string>, created: object, errors: string[], remapped: number}>}
 */
export async function applyInstall(guild, data, plan, { onProgress = null } = {}) {
  const idMap = new Map();
  const errors = [];
  const created = { roles: 0, categories: 0, channels: 0, updatedRoles: 0, settings: 0, deletes: 0 };
  const positionPairs = [];

  // 1) Roller
  for (const roleData of plan.createRoles) {
    try {
      const role = await guild.roles.create({
        name: roleData.name,
        color: roleData.color ?? 0,
        hoist: Boolean(roleData.hoist),
        mentionable: Boolean(roleData.mentionable),
        permissions: BigInt(roleData.permissions ?? '0'),
        reason: 'Backup: rol geri kuruldu',
      });
      idMap.set(String(roleData.id), role.id);
      positionPairs.push({
        role,
        position: Math.max(0, Math.min(roleData.position ?? role.position, (guild.members.me?.roles?.highest?.position ?? 1) - 1)),
      });
      created.roles += 1;
    } catch (err) {
      errors.push(`rol @${roleData.name}: ${err?.message ?? 'hata'}`);
    }
  }
  if (positionPairs.length > 0) {
    try {
      await guild.roles.setPositions(positionPairs, 'Backup: rol sıralaması geri kuruldu');
    } catch {
      /* siralama kritik degil */
    }
  }
  if (onProgress) await onProgress(`roller: ${created.roles}`);

  // 2) Kategoriler
  for (const category of plan.createCategories) {
    try {
      const channel = await guild.channels.create({
        name: category.name,
        type: ChannelType.GuildCategory,
        position: category.position,
        permissionOverwrites: overwriteList(category.overwrites, guild, idMap),
        reason: 'Backup: kategori geri kuruldu',
      });
      idMap.set(String(category.id), channel.id);
      created.categories += 1;
    } catch (err) {
      errors.push(`kategori ${category.name}: ${err?.message ?? 'hata'}`);
    }
  }

  // 3) Kanallar
  for (const channelData of plan.createChannels) {
    try {
      const options = {
        name: channelData.name,
        type: channelData.type,
        reason: 'Backup: kanal geri kuruldu',
        permissionOverwrites: overwriteList(channelData.overwrites, guild, idMap),
      };
      const parent = resolveParent(guild, data, channelData, idMap);
      if (parent) options.parent = parent;
      if (channelData.type === ChannelType.GuildVoice) {
        if (channelData.bitrate) options.bitrate = Math.min(channelData.bitrate, 96000);
        if (channelData.userLimit) options.userLimit = channelData.userLimit;
      } else {
        if (channelData.topic) options.topic = channelData.topic;
        options.nsfw = Boolean(channelData.nsfw);
        options.rateLimitPerUser = channelData.rateLimitPerUser ?? 0;
      }
      const channel = await guild.channels.create(options);
      idMap.set(String(channelData.id), channel.id);
      created.channels += 1;
    } catch (err) {
      errors.push(`kanal #${channelData.name}: ${err?.message ?? 'hata'}`);
    }
  }
  if (onProgress) await onProgress(`kanallar: ${created.categories + created.channels}`);

  // 4) Rol guncellemeleri
  for (const item of plan.updateRoles) {
    const role = guild.roles.cache.get(item.existingId);
    if (!role) continue;
    try {
      const patch = { reason: 'Backup: rol güncellendi' };
      if (item.changes.color !== undefined) patch.color = item.changes.color;
      if (item.changes.hoist !== undefined) patch.hoist = item.changes.hoist;
      if (item.changes.mentionable !== undefined) patch.mentionable = item.changes.mentionable;
      if (item.changes.permissions !== undefined) patch.permissions = BigInt(item.changes.permissions);
      await role.edit(patch);
      created.updatedRoles += 1;
    } catch (err) {
      errors.push(`rol güncelleme @${item.name}: ${err?.message ?? 'hata'}`);
    }
  }

  // 5) Sunucu ayarlari
  for (const item of plan.settings) {
    try {
      if (item.key === 'name') await guild.setName(String(item.to));
      else if (item.key === 'verificationLevel') await guild.setVerificationLevel(item.to);
      else if (item.key === 'afkTimeout') await guild.setAFKTimeout(item.to);
      else if (item.key === 'preferredLocale') await guild.setPreferredLocale(item.to);
      else if (item.key === 'afkChannelId') await guild.setAFKChannel(item.to ? mapId(item.to, idMap) : null);
      else if (item.key === 'systemChannelId') await guild.setSystemChannel(item.to ? mapId(item.to, idMap) : null);
      else if (item.key === 'rulesChannelId') await guild.setRulesChannel(item.to ? mapId(item.to, idMap) : null);
      created.settings += 1;
    } catch (err) {
      errors.push(`ayar ${item.key}: ${err?.message ?? 'hata'}`);
    }
  }

  // 6) Temizle (12.4/13.3): backup sonrasi olusan fazlaliklar
  for (const item of plan.deleteChannels) {
    const channel = guild.channels.cache.get(item.id);
    if (!channel) continue;
    try {
      await channel.delete('Backup: fazladan kanal temizlendi');
      created.deletes += 1;
    } catch (err) {
      errors.push(`kanal silme #${item.name}: ${err?.message ?? 'hata'}`);
    }
  }
  for (const item of plan.deleteRoles) {
    const role = guild.roles.cache.get(item.id);
    if (!role) continue;
    try {
      await role.delete('Backup: fazladan rol temizlendi');
      created.deletes += 1;
    } catch (err) {
      errors.push(`rol silme @${item.name}: ${err?.message ?? 'hata'}`);
    }
  }

  // 7) ID esleme guncellemesi
  const remapped = await remapMappedIds(guild.id, idMap);
  if (idMap.size > 0) invalidateLogChannelMap(guild.id);

  // 8) Silinen rol dagitimi
  if (data.memberRoles) {
    for (const [oldRoleId, memberIds] of Object.entries(data.memberRoles)) {
      const newRoleId = idMap.get(String(oldRoleId));
      if (!newRoleId || !Array.isArray(memberIds) || memberIds.length === 0) continue;
      requeueRoleMembers(guild, newRoleId, memberIds).catch(() => {});
    }
  }

  return { ok: errors.length === 0, idMap, created, errors, remapped };
}

/**
 * Tek rol geri kurma (/rol-kur). Ada gore eslesen rol varsa gunceller.
 * @returns {Promise<{ok: boolean, mode: 'created'|'updated'|'missing', role?: object, error?: string}>}
 */
export async function restoreSingleRole(guild, data, reference) {
  const ref = String(reference ?? '').trim().replace(/^@/, '');
  const roleData = (data.roles ?? []).find(
    (role) => role.id === ref || role.name.toLowerCase() === ref.toLowerCase(),
  );
  if (!roleData) return { ok: false, mode: 'missing', error: 'rol_backup_ta_yok' };

  const existing = guild.roles.cache.find((role) => role.name === roleData.name && !role.managed);
  if (existing) {
    try {
      await existing.edit({
        color: roleData.color ?? 0,
        hoist: Boolean(roleData.hoist),
        mentionable: Boolean(roleData.mentionable),
        permissions: BigInt(roleData.permissions ?? '0'),
        reason: 'Backup: rol güncellendi',
      });
      return { ok: true, mode: 'updated', role: existing };
    } catch (err) {
      return { ok: false, mode: 'missing', error: err?.message ?? 'guncellenemedi' };
    }
  }

  try {
    const role = await guild.roles.create({
      name: roleData.name,
      color: roleData.color ?? 0,
      hoist: Boolean(roleData.hoist),
      mentionable: Boolean(roleData.mentionable),
      permissions: BigInt(roleData.permissions ?? '0'),
      reason: 'Backup: rol geri kuruldu',
    });

    const idMap = new Map([[String(roleData.id), role.id]]);
    await remapMappedIds(guild.id, idMap);

    const memberIds = data.memberRoles?.[roleData.id] ?? roleData.memberIds ?? [];
    if (Array.isArray(memberIds) && memberIds.length > 0) {
      requeueRoleMembers(guild, role.id, memberIds).catch(() => {});
    }

    return { ok: true, mode: 'created', role };
  } catch (err) {
    return { ok: false, mode: 'missing', error: err?.message ?? 'olusturulamadi' };
  }
}

/**
 * Tek kanal geri kurma (/kanal-kur). Ada+ture gore eslesen kanal varsa dokunmaz.
 * @returns {Promise<{ok: boolean, mode: 'created'|'exists'|'missing', channel?: object, error?: string}>}
 */
export async function restoreSingleChannel(guild, data, reference) {
  const ref = String(reference ?? '').trim().replace(/^#/, '');
  const channelData = (data.channels ?? []).find(
    (channel) => channel.id === ref || channel.name.toLowerCase() === ref.toLowerCase(),
  );
  if (!channelData) return { ok: false, mode: 'missing', error: 'kanal_backup_ta_yok' };

  const existing = guild.channels.cache.find(
    (channel) => channel.type === channelData.type && channel.name === channelData.name,
  );
  if (existing) return { ok: true, mode: 'exists', channel: existing };

  try {
    const idMap = new Map();
    const options = {
      name: channelData.name,
      type: channelData.type,
      reason: 'Backup: kanal geri kuruldu',
      permissionOverwrites: overwriteList(channelData.overwrites, guild, idMap),
    };
    const parent = resolveParent(guild, data, channelData, idMap);
    if (parent) options.parent = parent;
    if (channelData.type === ChannelType.GuildVoice) {
      if (channelData.bitrate) options.bitrate = Math.min(channelData.bitrate, 96000);
      if (channelData.userLimit) options.userLimit = channelData.userLimit;
    } else {
      if (channelData.topic) options.topic = channelData.topic;
      options.nsfw = Boolean(channelData.nsfw);
      options.rateLimitPerUser = channelData.rateLimitPerUser ?? 0;
    }

    const channel = await guild.channels.create(options);
    await remapMappedIds(guild.id, new Map([[String(channelData.id), channel.id]]));
    return { ok: true, mode: 'created', channel };
  } catch (err) {
    return { ok: false, mode: 'missing', error: err?.message ?? 'olusturulamadi' };
  }
}
