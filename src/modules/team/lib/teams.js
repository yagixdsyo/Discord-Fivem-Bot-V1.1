/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { PermissionFlagsBits } from 'discord.js';
import { insertDoc, findDocs, findOneDoc, updateDoc, deleteDocs } from '../../fivem/lib/store.js';
import { getGuildConfig, setGuildSetting } from '../../../core/guildSettings.js';
import { createTranslator } from '../../../locales/index.js';
import { buildTeamPanel } from './panel.js';

const TEAMS = 'teams';
const TEAM_MEMBERS = 'team_members';
const SETTINGS_KEY = 'team';

export function normalizeColor(value) {
  const raw = String(value || '').trim();
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return null;
  return Number.parseInt(hex, 16);
}

/** Ekip modulu ayarlari (ekip ust rolu + dil). */
export async function getTeamSettings(guildId) {
  try {
    const config = await getGuildConfig(guildId);
    const settings = config?.settings?.[SETTINGS_KEY] ?? {};
    return { anchorRoleId: settings.anchorRoleId ?? null, language: config?.language ?? 'tr' };
  } catch {
    return { anchorRoleId: null, language: 'tr' };
  }
}

/** Ekip ayarlarini kaydeder (kismi guncelleme). */
export async function setTeamSettings(guildId, patch = {}) {
  const current = await getTeamSettings(guildId);
  return setGuildSetting(guildId, SETTINGS_KEY, {
    anchorRoleId: patch.anchorRoleId !== undefined ? patch.anchorRoleId : current.anchorRoleId,
  });
}

function makeId(name) {
  return `team-${String(name || 'ekip').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function listTeams(guildId, { kind = null, closed = false } = {}) {
  const filter = { guild_id: guildId, closed: !!closed };
  if (kind) filter.kind = kind;
  return findDocs(TEAMS, filter, { sort: { created_at: -1 }, limit: 100 });
}

export async function getTeam(guildId, teamId) {
  return findOneDoc(TEAMS, { guild_id: guildId, team_id: teamId });
}

const TR_NORM = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', İ: 'i' };

/** Ekip: once team_id ile, sonra Turkce-uyumlu ad eslesmesiyle cozumlenir. */
export async function resolveTeam(guildId, query) {
  const q = String(query || '').trim();
  if (!q) return null;
  const byId = await getTeam(guildId, q);
  if (byId) return byId;
  const norm = (s) => String(s || '').toLowerCase().replace(/[çğıöşüİ]/g, (c) => TR_NORM[c] ?? c).replace(/\s+/g, ' ').trim();
  const needle = norm(q);
  if (!needle) return null;
  const teams = await listTeams(guildId);
  return (
    teams.find((x) => norm(x.name) === needle) ??
    teams.find((x) => norm(x.name).includes(needle) || needle.includes(norm(x.name))) ??
    null
  );
}

export async function createTeam({ guild, name, kind, bossMember, limit, color, anchorRoleId = null, t = null }) {
  const tr = t ?? createTranslator('tr');
  const accent = normalizeColor(color) ?? 0x5865f2;
  const role = await guild.roles.create({
    name: String(name).slice(0, 100),
    color: accent,
    reason: `Ekip oluşturma: ${name}`,
  }).catch(() => null);

  // Rol konumu: ekip ust rolunun hemen uzerine yerlestirilir (ayarlanmissa).
  if (role && anchorRoleId) {
    try {
      const anchor =
        guild.roles.cache.get(anchorRoleId) ?? (await guild.roles.fetch(anchorRoleId).catch(() => null));
      if (anchor) {
        await role.setPosition(anchor.position + 1, { reason: `Ekip rolü: ${name}` }).catch(() => {});
      }
    } catch {
      /* konum ayarlanamadi */
    }
  }

  const roleMemberIds = bossMember ? [bossMember.id] : [];
  let category = null;
  let textChannel = null;
  let voiceChannel = null;
  try {
    const overwrites = [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }];
    if (role) {
      overwrites.push({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      });
    }
    category = await guild.channels.create({
      name: name.slice(0, 50),
      type: 4,
      reason: `Ekip kategorisi: ${name}`,
      permissionOverwrites: overwrites,
    });
    textChannel = await guild.channels.create({
      name: `${name}-panel`.slice(0, 100),
      type: 0,
      parent: category.id,
      reason: `Ekip panel kanalı`,
    });
    voiceChannel = await guild.channels.create({
      name: `${name}-ses`.slice(0, 100),
      type: 2,
      parent: category.id,
      reason: `Ekip ses kanalı`,
    });
  } catch {
    category = null;
    textChannel = null;
    voiceChannel = null;
  }

  const team = {
    team_id: makeId(name),
    guild_id: guild.id,
    name,
    kind: kind === 'illegal' ? 'illegal' : 'legal',
    boss_id: bossMember?.id ?? null,
    member_ids: roleMemberIds,
    member_limit: Number(limit) > 1 ? Math.min(Number(limit), 200) : 0,
    color,
    role_id: role?.id ?? null,
    category_id: category?.id ?? null,
    text_channel_id: textChannel?.id ?? null,
    voice_channel_id: voiceChannel?.id ?? null,
    panel_channel_id: textChannel?.id ?? null,
    panel_message_id: null,
    application_open: true,
    closed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (role && bossMember) await bossMember.roles.add(role).catch(() => {});
  await insertDoc(TEAMS, team);

  // Panel mesajini gonder + sabitle (kanal olustuysa).
  if (textChannel) {
    try {
      const sent = await textChannel.send(buildTeamPanel(tr, team));
      if (typeof sent?.pin === 'function') await sent.pin().catch(() => {});
      team.panel_message_id = sent?.id ?? null;
      if (team.panel_message_id) {
        await updateDoc(
          TEAMS,
          { guild_id: guild.id, team_id: team.team_id },
          { panel_message_id: team.panel_message_id },
        );
      }
    } catch {
      /* panel gonderilemedi; /ekip panel ile yeniden denenebilir */
    }
  }

  return team;
}

export async function updateTeam({ guild = null, guildId, teamId, patch }) {
  const team = await getTeam(guildId, teamId);
  if (!team) return null;
  const nextName = patch.name ?? team.name;
  const nextColor = patch.color ?? team.color;
  await updateDoc(TEAMS, { guild_id: guildId, team_id: teamId }, {
    name: nextName,
    kind: patch.kind ?? team.kind,
    boss_id: patch.boss_id ?? team.boss_id,
    member_limit: patch.member_limit ?? team.member_limit,
    color: nextColor,
    role_id: team.role_id,
    category_id: team.category_id,
    text_channel_id: team.text_channel_id,
    voice_channel_id: team.voice_channel_id,
    panel_channel_id: team.panel_channel_id,
    panel_message_id: team.panel_message_id,
    application_open: patch.application_open ?? team.application_open,
    updated_at: new Date().toISOString(),
  });

  // Discord tarafi senkron: rol adi/rengi/konumu, kategori adi, yeni patron rolu.
  if (guild) {
    const role = team.role_id
      ? guild.roles.cache.get(team.role_id) ?? (await guild.roles.fetch(team.role_id).catch(() => null))
      : null;
    if (role) {
      if (patch.name) await role.setName(String(nextName).slice(0, 100), 'Ekip güncelleme').catch(() => {});
      if (patch.color) {
        const parsed = normalizeColor(nextColor);
        if (parsed !== null) await role.setColor(parsed, 'Ekip güncelleme').catch(() => {});
      }
      // Ayarlanan ust rolun hemen uzerinde kalmasini garantile.
      const settings = await getTeamSettings(guildId).catch(() => ({ anchorRoleId: null }));
      if (settings.anchorRoleId) {
        const anchor =
          guild.roles.cache.get(settings.anchorRoleId) ?? (await guild.roles.fetch(settings.anchorRoleId).catch(() => null));
        if (anchor && role.position <= anchor.position) {
          await role.setPosition(anchor.position + 1, { reason: 'Ekip rolü üste taşındı' }).catch(() => {});
        }
      }
    }
    if (patch.name && team.category_id) {
      const category =
        guild.channels.cache.get(team.category_id) ?? (await guild.channels.fetch(team.category_id).catch(() => null));
      if (category?.setName) await category.setName(String(nextName).slice(0, 50), 'Ekip güncelleme').catch(() => {});
    }
    if (patch.boss_id && patch.boss_id !== team.boss_id) {
      const member = await guild.members.fetch(patch.boss_id).catch(() => null);
      if (member && role) await member.roles.add(role, 'Ekip patronu').catch(() => {});
      if (member) {
        const fresh = await getTeam(guildId, teamId);
        if (fresh && !(fresh.member_ids ?? []).includes(patch.boss_id)) {
          await updateDoc(TEAMS, { guild_id: guildId, team_id: teamId }, {
            member_ids: [...(fresh.member_ids ?? []), patch.boss_id],
          });
        }
      }
    }
  }

  return getTeam(guildId, teamId);
}

export async function closeTeam({ team, guild }) {
  if (!team) return false;
  if (team.role_id) {
    const role = guild.roles.cache.get(team.role_id) ?? await guild.roles.fetch(team.role_id).catch(() => null);
    if (role) await role.delete('Ekip kapat').catch(() => {});
  }
  if (team.text_channel_id) {
    const ch = guild.channels.cache.get(team.text_channel_id) ?? await guild.channels.fetch(team.text_channel_id).catch(() => null);
    if (ch) await ch.delete('Ekip kapat').catch(() => {});
  }
  if (team.voice_channel_id) {
    const ch = guild.channels.cache.get(team.voice_channel_id) ?? await guild.channels.fetch(team.voice_channel_id).catch(() => null);
    if (ch) await ch.delete('Ekip kapat').catch(() => {});
  }
  if (team.category_id) {
    const ch = guild.channels.cache.get(team.category_id) ?? await guild.channels.fetch(team.category_id).catch(() => null);
    if (ch) await ch.delete('Ekip kapat').catch(() => {});
  }
  await updateDoc(TEAMS, { guild_id: team.guild_id, team_id: team.team_id }, { closed: true, closed_at: new Date().toISOString() });
  if (team.role_id) {
    for (const memberId of (team.member_ids || [])) {
      const member = await guild.members.fetch(memberId).catch(() => null);
      if (member) await member.roles.remove(team.role_id, 'Ekip kapat').catch(() => {});
    }
  }
  return true;
}

export async function addTeamMember(guildId, teamId, memberId) {
  const team = await getTeam(guildId, teamId);
  if (!team || team.closed) return false;
  if ((team.member_ids || []).includes(memberId)) return true;
  const next = [...(team.member_ids || []), memberId];
  await updateDoc(TEAMS, { guild_id: guildId, team_id: teamId }, { member_ids: next });
  return true;
}

export async function removeTeamMember(guildId, teamId, memberId) {
  const team = await getTeam(guildId, teamId);
  if (!team) return false;
  const next = (team.member_ids || []).filter((x) => x !== memberId);
  await updateDoc(TEAMS, { guild_id: guildId, team_id: teamId }, { member_ids: next });
  return true;
}

export async function teamSync({ guild, team, cfg = {} }) {
  if (!team?.role_id) return { added: 0, removed: 0, missing: [], errors: ['Rol yok'] };
  const role = guild.roles.cache.get(team.role_id) ?? await guild.roles.fetch(team.role_id).catch(() => null);
  if (!role) return { added: 0, removed: 0, missing: [], errors: ['Rol bulunamadi'] };
  const dbIds = new Set(team.member_ids || []);
  let added = 0;
  const missing = [];
  for (const id of dbIds) {
    const member = await guild.members.fetch(id).catch(() => null);
    if (member && !role.members.has(id)) {
      await member.roles.add(role, 'Ekip senkron').catch(() => {});
      added += 1;
    }
  }
  const roleMemberIds = [...role.members.keys()];
  let removed = 0;
  for (const id of roleMemberIds) {
    if (dbIds.has(id)) continue;
    const member = role.members.get(id);
    if (member) missing.push(id);
    if (cfg.removeExtra && member) {
      await member.roles.remove(role, 'Ekip senkron').catch(() => {});
      removed += 1;
    }
  }
  const newDb = [...new Set([...dbIds, ...roleMemberIds])];
  await updateDoc(TEAMS, { guild_id: team.guild_id, team_id: team.team_id }, { member_ids: newDb });
  return { added, removed, missing, role_size: role.members.size };
}

export async function teamSyncAll(guild, { removeExtra = false } = {}) {
  const teams = await listTeams(guild.id, { closed: false });
  const reports = [];
  for (const team of teams) reports.push({ team_id: team.team_id, team_name: team.name, ...(await teamSync({ guild, team, cfg: { removeExtra } })) });
  return reports;
}

export async function setTeamBoss(guildId, teamId, bossId) {
  return updateTeam({ guildId, teamId, patch: { boss_id: bossId } });
}

export async function setTeamApplicationOpen(guildId, teamId, open) {
  return updateTeam({ guildId, teamId, patch: { application_open: !!open } });
}

/** Panel mesajini gunceller; mesaj yoksa yeniden gonderir ve sabitler. */
export async function refreshTeamPanel({ guild, team, t = null }) {
  const tr = t ?? createTranslator('tr');
  const channelId = team.panel_channel_id ?? team.text_channel_id;
  if (!channelId) return { ok: false, error: 'kanal_yok' };

  const channel =
    guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel || typeof channel.send !== 'function') return { ok: false, error: 'kanal_yok' };

  const panelPayload = buildTeamPanel(tr, team);
  if (team.panel_message_id) {
    const message = await channel.messages?.fetch?.(team.panel_message_id).catch(() => null);
    if (message) {
      await message.edit(panelPayload).catch(() => {});
      return { ok: true, updated: true };
    }
  }

  try {
    const sent = await channel.send(panelPayload);
    if (typeof sent?.pin === 'function') await sent.pin().catch(() => {});
    await updateDoc(
      TEAMS,
      { guild_id: team.guild_id, team_id: team.team_id },
      { panel_channel_id: channel.id, panel_message_id: sent?.id ?? null },
    );
    return { ok: true, posted: true, messageId: sent?.id ?? null };
  } catch {
    return { ok: false, error: 'gonderilemedi' };
  }
}
