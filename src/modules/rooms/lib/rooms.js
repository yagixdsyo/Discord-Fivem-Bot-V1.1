/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import {
  ActionRowBuilder,
  ChannelType,
  PermissionFlagsBits,
  UserSelectMenuBuilder,
} from 'discord.js';
import { card } from '../../../ui/templates/base.js';
import { button, row } from '../../../ui/v2.js';
import { deleteDocs, findOneDoc, findDocs, insertDoc, updateDoc } from '../../fivem/lib/store.js';
import { getSetting, setSetting } from '../../fivem/lib/state.js';

const COL = 'rooms';
const BANS = 'room_bans';
export const ROOMS_KEY = 'rooms.config';

export async function getRoomsConfig(guildId) {
  const raw = await getSetting(guildId, ROOMS_KEY);
  return {
    panelChannelId: raw?.panelChannelId ?? null,
    panelMessageId: raw?.panelMessageId ?? null,
    hubChannelId: raw?.hubChannelId ?? null,
    categoryId: raw?.categoryId ?? null,
    // sahip odadan cikinca oda silinsin mi (varsayilan: evet).
    ownerLeaveDelete: raw?.ownerLeaveDelete !== false,
  };
}

export async function setRoomsConfig(guildId, patch = {}) {
  const current = await getRoomsConfig(guildId);
  const merged = { ...current, ...patch };
  const ok = await setSetting(guildId, ROOMS_KEY, merged);
  return ok ? merged : null;
}

function roomId() {
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Yeni oda olusturur (panel + kayit). */
export async function createRoom(guild, owner, { name = null, limit = 0, parentId = null } = {}) {
  const me = guild.members.me;
  const channelName = String(name ?? `${owner.username} odası`).slice(0, 100);

  const channel = await guild.channels
    .create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: parentId ?? null,
      userLimit: Math.max(0, Math.min(99, Number(limit) || 0)),
      permissionOverwrites: [
        { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
        {
          id: owner.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers],
        },
        { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels] },
      ],
      reason: `Ozel oda: ${owner.id}`,
    })
    .catch(() => null);

  if (!channel) return { ok: false, error: 'kanal_olusturulamadi' };

  const doc = {
    room_id: roomId(),
    guild_id: guild.id,
    channel_id: channel.id,
    owner_id: owner.id,
    name: channelName,
    limit: Number(limit) || 0,
    locked: false,
    panel_message_id: null,
  };
  await insertDoc(COL, doc);
  return { ok: true, doc, channel };
}

/** Odanin kontrol panelini odanin ses-sohbetine gonderir. */
export async function postRoomPanel(guild, doc, t) {
  const channel = guild.channels.cache.get(doc.channel_id) ?? (await guild.channels.fetch(doc.channel_id).catch(() => null));
  if (!channel || typeof channel.send !== 'function') return { ok: false, error: 'kanal_yok' };
  try {
    const message = await channel.send(await roomPanelPayload(t, doc, { guild }));
    await updateDoc(COL, { guild_id: guild.id, room_id: doc.room_id }, { panel_message_id: message.id });
    return { ok: true, messageId: message.id };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

/** Oda panelini yerinde gunceller (uye/yasak listesi tazelenir). */
export async function refreshRoomPanel(guild, doc, t) {
  if (!doc?.panel_message_id) return { ok: false, error: 'panel_yok' };
  const channel = guild.channels.cache.get(doc.channel_id) ?? (await guild.channels.fetch(doc.channel_id).catch(() => null));
  if (!channel || typeof channel.messages?.fetch !== 'function') return { ok: false, error: 'kanal_yok' };
  const message = await channel.messages.fetch(doc.panel_message_id).catch(() => null);
  if (!message) return { ok: false, error: 'mesaj_yok' };
  const payload = await roomPanelPayload(t, doc, { guild });
  await message.edit(payload).catch(() => {});
  return { ok: true };
}

export async function getRoomByChannel(guildId, channelId) {
  return findOneDoc(COL, { guild_id: guildId, channel_id: channelId });
}

export async function getRoom(guildId, roomIdValue) {
  return findOneDoc(COL, { guild_id: guildId, room_id: roomIdValue });
}

export async function getRoomByOwner(guildId, ownerId) {
  return findOneDoc(COL, { guild_id: guildId, owner_id: ownerId });
}

export async function deleteRoom(guild, doc, { reason } = {}) {
  const channel = guild.channels.cache.get(doc.channel_id) ?? (await guild.channels.fetch(doc.channel_id).catch(() => null));
  if (channel) await channel.delete(reason).catch(() => {});
  await deleteDocs(COL, { guild_id: guild.id, room_id: doc.room_id });
  await deleteDocs(BANS, { guild_id: guild.id, room_id: doc.room_id });
  return { ok: true };
}

export async function lockRoom(guild, doc, locked) {
  const channel = guild.channels.cache.get(doc.channel_id) ?? (await guild.channels.fetch(doc.channel_id).catch(() => null));
  if (!channel) return { ok: false, error: 'kanal_yok' };
  try {
    await channel.permissionOverwrites.edit(guild.roles.everyone.id, { Connect: locked ? false : null });
    await updateDoc(COL, { guild_id: guild.id, room_id: doc.room_id }, { locked: Boolean(locked) });
    return { ok: true, locked: Boolean(locked) };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

export async function setRoomLimit(guild, doc, limit) {
  const channel = guild.channels.cache.get(doc.channel_id) ?? (await guild.channels.fetch(doc.channel_id).catch(() => null));
  if (!channel) return { ok: false, error: 'kanal_yok' };
  try {
    const value = Math.max(0, Math.min(99, Number(limit) || 0));
    await channel.setUserLimit(value);
    await updateDoc(COL, { guild_id: guild.id, room_id: doc.room_id }, { limit: value });
    return { ok: true, limit: value };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

export async function renameRoom(guild, doc, name) {
  const channel = guild.channels.cache.get(doc.channel_id) ?? (await guild.channels.fetch(doc.channel_id).catch(() => null));
  if (!channel) return { ok: false, error: 'kanal_yok' };
  try {
    const value = String(name).slice(0, 100);
    await channel.setName(value);
    await updateDoc(COL, { guild_id: guild.id, room_id: doc.room_id }, { name: value });
    return { ok: true, name: value };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

/** Odaya davet: banliysa once yasak kaldirilir, kullanici cekilir. */
export async function inviteToRoom(guild, doc, member, byId) {
  const channel = guild.channels.cache.get(doc.channel_id) ?? (await guild.channels.fetch(doc.channel_id).catch(() => null));
  if (!channel) return { ok: false, error: 'kanal_yok' };
  try {
    await channel.permissionOverwrites.edit(member.id, { ViewChannel: null, Connect: null }).catch(() => {});
    await deleteDocs(BANS, { guild_id: guild.id, room_id: doc.room_id, user_id: member.id });
    if (member.voice?.channelId) await member.voice.setChannel(channel, `Oda daveti: ${byId}`).catch(() => {});
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

/** Odadan cikar: atilir + yeniden katilmasi kapatilir (yasak kaydi acilmaz). */
export async function kickFromRoom(guild, doc, member, byId) {
  const channel = guild.channels.cache.get(doc.channel_id) ?? (await guild.channels.fetch(doc.channel_id).catch(() => null));
  if (!channel) return { ok: false, error: 'kanal_yok' };
  try {
    if (member.voice?.channelId === channel.id) await member.voice.disconnect(`Odadan cikarildi: ${byId}`).catch(() => {});
    await channel.permissionOverwrites.edit(member.id, { Connect: false, ViewChannel: null });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

/** Odadan yasakla: goruntuleme/katilma kapatilir + kayit. */
export async function banFromRoom(guild, doc, member, byId) {
  const channel = guild.channels.cache.get(doc.channel_id) ?? (await guild.channels.fetch(doc.channel_id).catch(() => null));
  if (!channel) return { ok: false, error: 'kanal_yok' };
  try {
    if (member.voice?.channelId === channel.id) await member.voice.disconnect(`Oda yasagi: ${byId}`).catch(() => {});
    await channel.permissionOverwrites.edit(member.id, { ViewChannel: false, Connect: false });
    const existing = await findOneDoc(BANS, { guild_id: guild.id, room_id: doc.room_id, user_id: member.id });
    if (!existing) {
      await insertDoc(BANS, { guild_id: guild.id, room_id: doc.room_id, user_id: member.id, by: byId });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

export async function listRoomBans(guildId, roomIdValue) {
  return findDocs(BANS, { guild_id: guildId, room_id: roomIdValue }, { limit: 50 });
}

/** Oda kurulum (olusturma) paneli — /oda-kur ve kurulum sistemi ayni kartı kullanir. */
export function roomCreatePanelPayload(t) {
  return card({
    emojiKey: 'ODA',
    title: t('fivem.rooms.setup_panel_title'),
    lines: [t('fivem.rooms.setup_panel_line'), t('fivem.rooms.setup_panel_hint')],
    accent: 'primary',
    buttons: [row([button({ id: 'oda:olustur', label: t('fivem.rooms.create_button'), emojiKey: 'EKLE', style: 'primary' })])],
  });
}

/** Panel icin canli veri: uyeler + yasak sayisi. */
export async function roomPanelData(guild, doc) {
  const channel = guild.channels.cache.get(doc.channel_id) ?? (await guild.channels.fetch(doc.channel_id).catch(() => null));
  const members = channel
    ? [...(channel.members?.values?.() ?? [])].filter((member) => !member.user?.bot)
    : [];
  let banCount = 0;
  try {
    banCount = (await findDocs(BANS, { guild_id: guild.id, room_id: doc.room_id }, { limit: 100 })).length;
  } catch {
    banCount = 0;
  }
  return { channel, members, banCount };
}

export async function roomPanelPayload(t, doc, { guild = null } = {}) {
  let members = [];
  let banCount = 0;
  if (guild) {
    const data = await roomPanelData(guild, doc);
    members = data.members;
    banCount = data.banCount;
  }

  const shown = members.slice(0, 10).map((member) => `<@${member.id}>`);
  if (members.length > shown.length) shown.push(`+${members.length - shown.length}`);
  const memberList = shown.length ? shown.join(', ') : t('fivem.rooms.panel_members_empty');

  const lines = [
    t('fivem.rooms.panel_owner', { sahip: `<@${doc.owner_id}>` }),
    t('fivem.rooms.panel_limit', { limit: doc.limit > 0 ? `**${doc.limit}**` : t('fivem.rooms.unlimited') }),
    t('fivem.rooms.panel_lock', { durum: doc.locked ? t('fivem.rooms.locked') : t('fivem.rooms.unlocked') }),
    t('fivem.rooms.panel_members', { adet: members.length, liste: memberList }),
    t('fivem.rooms.panel_bans', { adet: banCount }),
  ];

  const buttons = row([
    button({ id: `oda:isim:${doc.room_id}`, label: t('fivem.rooms.btn_name'), emojiKey: 'DUZENLE', style: 'secondary' }),
    button({ id: `oda:limit:${doc.room_id}`, label: t('fivem.rooms.btn_limit'), emojiKey: 'KULLANICILAR', style: 'secondary' }),
    button({
      id: `oda:kilit:${doc.room_id}`,
      label: doc.locked ? t('fivem.rooms.btn_unlock') : t('fivem.rooms.btn_lock'),
      emojiKey: doc.locked ? 'KILIT_ACIK' : 'KILIT',
      style: 'primary',
    }),
    button({ id: `oda:sil:${doc.room_id}`, label: t('fivem.rooms.btn_delete'), emojiKey: 'SIL', style: 'danger' }),
  ]);

  const selectRow = (action, placeholder) =>
    new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(`oda:${action}:${doc.room_id}`)
        .setPlaceholder(placeholder)
        .setMinValues(1)
        .setMaxValues(1),
    );

  const addRow = selectRow('ekle', t('fivem.rooms.select_invite'));
  const kickRow = selectRow('cikar', t('fivem.rooms.select_remove'));
  const banRow = selectRow('yasak', t('fivem.rooms.select_ban'));

  return card({
    emojiKey: 'ODA',
    title: t('fivem.rooms.panel_title', { oda: doc.name }),
    lines,
    accent: doc.locked ? 'warn' : 'primary',
    buttons: [buttons, addRow, kickRow, banRow],
    footer: `\`${doc.room_id}\``,
  });
}
