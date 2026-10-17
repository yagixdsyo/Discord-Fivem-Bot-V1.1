/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { findDocs, findOneDoc, insertDoc, updateDoc } from './store.js';

const COL = 'teams';
export const TEAM_SEPARATOR = '││';

export async function createTeam(guild, { name, type = 'legal', patron = null, limit = 0, color = null, actorId }) {
  const clean = String(name ?? '').trim().slice(0, 60);
  if (!clean) return { ok: false, error: 'isim_bos' };

  const existing = await findOneDoc(COL, { guild_id: guild.id, name: clean, active: true });
  if (existing) return { ok: false, error: 'isim_kullanimda' };

  const me = guild.members.me;
  const role = await guild.roles
    .create({
      name: clean,
      color: color ?? undefined,
      mentionable: true,
      reason: `Ekip acildi: ${actorId}`,
    })
    .catch((err) => ({ error: err }));
  if (role?.error) return { ok: false, error: String(role.error.message ?? role.error) };

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect] },
    { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] },
  ];

  const category = await guild.channels
    .create({
      name: `${TEAM_SEPARATOR}${clean}`,
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites,
      reason: `Ekip: ${actorId}`,
    })
    .catch(() => null);

  const text = await guild.channels
    .create({
      name: 'sohbet',
      type: ChannelType.GuildText,
      parent: category?.id,
      reason: `Ekip: ${actorId}`,
    })
    .catch(() => null);

  const ticket = await guild.channels
    .create({
      name: 'ticket',
      type: ChannelType.GuildText,
      parent: category?.id,
      reason: `Ekip: ${actorId}`,
    })
    .catch(() => null);

  const voice = await guild.channels
    .create({
      name: 'genel',
      type: ChannelType.GuildVoice,
      parent: category?.id,
      reason: `Ekip: ${actorId}`,
    })
    .catch(() => null);

  const doc = {
    team_id: `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    guild_id: guild.id,
    name: clean,
    type,
    role_id: role.id,
    category_id: category?.id ?? null,
    text_id: text?.id ?? null,
    ticket_id: ticket?.id ?? null,
    voice_id: voice?.id ?? null,
    patron_id: patron?.id ?? null,
    boss_ids: [],
    limit,
    active: true,
    writing_locked: false,
    basvuru_acik: false,
  };
  await insertDoc(COL, doc);
  return { ok: true, doc };
}

export async function getTeam(guildId, { teamId = null, name = null, roleId = null } = {}) {
  if (teamId) return findOneDoc(COL, { guild_id: guildId, team_id: teamId });
  if (roleId) return findOneDoc(COL, { guild_id: guildId, role_id: roleId });
  if (name) return findOneDoc(COL, { guild_id: guildId, name });
  return null;
}

export async function listTeams(guildId, { type = null, active = true, limit = 50 } = {}) {
  const filter = { guild_id: guildId };
  if (type) filter.type = type;
  if (active !== null) filter.active = active;
  return findDocs(COL, filter, { sort: { created_at: -1 }, limit });
}

export async function updateTeam(guildId, teamId, patch) {
  return updateDoc(COL, { guild_id: guildId, team_id: teamId }, patch);
}

export async function closeTeam(guild, team, { actorId }) {
  const failed = [];
  const channelIds = [team.text_id, team.ticket_id, team.voice_id].filter(Boolean);
  for (const id of channelIds) {
    const channel = guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
    if (channel) await channel.delete(`Ekip kapatildi: ${actorId}`).catch(() => failed.push(id));
  }
  if (team.category_id) {
    const category = guild.channels.cache.get(team.category_id) ?? (await guild.channels.fetch(team.category_id).catch(() => null));
    if (category) await category.delete(`Ekip kapatildi: ${actorId}`).catch(() => failed.push(team.category_id));
  }
  if (team.role_id) {
    const role = guild.roles.cache.get(team.role_id) ?? (await guild.roles.fetch(team.role_id).catch(() => null));
    if (role) await role.delete(`Ekip kapatildi: ${actorId}`).catch(() => failed.push(team.role_id));
  }

  await updateDoc(COL, { guild_id: guild.id, team_id: team.team_id }, { active: false, closed_at: new Date().toISOString() });
  return { ok: failed.length === 0, failed };
}

/** Ekip ticket kanalinda yazmayi patron + boss ile sinirlar/kaldirir. */
export async function toggleWritingLock(guild, team, locked, { actorId }) {
  const channelId = team.ticket_id ?? team.text_id;
  if (!channelId) return { ok: false, error: 'kanal_yok' };
  const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel) return { ok: false, error: 'kanal_yok' };

  try {
    if (locked) {
      await channel.permissionOverwrites.edit(guild.roles.everyone.id, { SendMessages: false });
      await channel.permissionOverwrites.edit(team.role_id, { SendMessages: false });
      if (team.patron_id) {
        const patron = guild.members.cache.get(team.patron_id);
        if (patron) await channel.permissionOverwrites.edit(patron.id, { SendMessages: true });
      }
      for (const bossId of team.boss_ids ?? []) {
        await channel.permissionOverwrites.edit(bossId, { SendMessages: true });
      }
    } else {
      await channel.permissionOverwrites.edit(team.role_id, { SendMessages: true });
      await channel.permissionOverwrites.edit(guild.roles.everyone.id, { SendMessages: false });
      for (const bossId of team.boss_ids ?? []) {
        await channel.permissionOverwrites.delete(bossId).catch(() => {});
      }
      if (team.patron_id) await channel.permissionOverwrites.delete(team.patron_id).catch(() => {});
    }
    await updateTeam(guild.id, team.team_id, { writing_locked: Boolean(locked) });
    return { ok: true, channelId };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}
