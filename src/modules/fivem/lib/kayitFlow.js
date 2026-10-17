/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ActionRowBuilder, UserSelectMenuBuilder } from 'discord.js';
import { card } from '../../../ui/templates/base.js';
import { markSanctioned } from '../../guard/lib/sanction.js';
import { getRoleId } from './maps.js';
import { addRegistration, getByUser, isRegistered, updateRegistrationName } from './registration.js';
import { getSetting, setSetting } from './state.js';

export const KAYIT_KEY = 'fivem.kayit';
export const KAYIT_PANEL_KEY = 'fivem.kayit.panel';

export async function getKayitState(guildId) {
  const raw = await getSetting(guildId, KAYIT_KEY);
  return { open: raw?.open !== false, by: raw?.by ?? null, at: raw?.at ?? null };
}

export async function setKayitState(guildId, open, by) {
  return setSetting(guildId, KAYIT_KEY, { open: Boolean(open), by, at: new Date().toISOString() });
}

export async function getKayitPanel(guildId) {
  const raw = await getSetting(guildId, KAYIT_PANEL_KEY);
  return { channelId: raw?.channelId ?? null, messageId: raw?.messageId ?? null };
}

export async function setKayitPanel(guildId, panel) {
  return setSetting(guildId, KAYIT_PANEL_KEY, panel);
}

/** Interaktif kayit paneli: iki select menu (Kayıt Et / Kayıtsıza At). */
export function kayitInteractivePayload(t, { open = true } = {}) {
  if (!open) {
    return card({
      emojiKey: 'KAYIT_KAPALI',
      title: t('fivem.kayit.panel_title'),
      lines: [t('fivem.kayit.panel_status', { durum: t('fivem.kayit.closed') }), t('fivem.kayit.panel_closed_hint')],
      accent: 'error',
      footer: t('fivem.kayit.panel_footer'),
    });
  }

  const registerRow = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder().setCustomId('kayit:et').setPlaceholder(t('fivem.kayit.select_register')).setMinValues(1).setMaxValues(1),
  );
  const unregisterRow = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder().setCustomId('kayit:sifirla').setPlaceholder(t('fivem.kayit.select_unregister')).setMinValues(1).setMaxValues(1),
  );

  return card({
    emojiKey: 'KAYIT_ACIK',
    title: t('fivem.kayit.panel_title'),
    lines: [t('fivem.kayit.panel_status', { durum: t('fivem.kayit.open') }), t('fivem.kayit.panel_hint')],
    accent: 'success',
    buttons: [registerRow, unregisterRow],
    footer: t('fivem.kayit.panel_footer'),
  });
}

/** Panel mesajini duzenler; yoksa gonderir ve kaydeder. */
export async function refreshKayitPanel(guild, t, { open = true, channelId = null } = {}) {
  const panel = await getKayitPanel(guild.id);
  const targetChannelId = channelId ?? panel.channelId;
  if (!targetChannelId) return { ok: false, error: 'kanal_yok' };

  const channel = guild.channels.cache.get(targetChannelId) ?? (await guild.channels.fetch(targetChannelId).catch(() => null));
  if (!channel || typeof channel.send !== 'function') return { ok: false, error: 'kanal_yok' };

  const payload = kayitInteractivePayload(t, { open });
  if (panel.messageId) {
    const message = await channel.messages.fetch(panel.messageId).catch(() => null);
    if (message) {
      await message.edit(payload).catch(() => {});
      return { ok: true, updated: true };
    }
  }

  const sent = await channel.send(payload);
  await setKayitPanel(guild.id, { channelId: channel.id, messageId: sent.id });
  return { ok: true, posted: true };
}

/**
 * Kayit islemi: roller + takma ad + kayit kaydi.
 * @returns {Promise<{ok: boolean, error?: string, detail?: string}>}
 */
export async function registerMember(guild, { member, actor, actorTag = null, icName, oocName = null, minAccountDays = 0 }) {
  const blacklistRoleId = await getRoleId(guild.id, 'blacklist');
  if (blacklistRoleId && member.roles.cache.has(blacklistRoleId)) {
    return { ok: false, error: 'blacklist' };
  }

  if (await isRegistered(guild.id, member.id)) {
    // kayitli uyede isim farkliysa "yeniden kayit" isim guncellemesidir.
    const existing = await getByUser(guild.id, member.id);
    const nextName = String(icName).slice(0, 32);
    const nextOoc = oocName ?? existing?.ooc_name ?? null;
    if (existing?.ic_name === nextName && (!oocName || existing?.ooc_name === oocName)) {
      return { ok: false, error: 'zaten_kayitli' };
    }
    try {
      const previous = existing?.ic_name ?? null;
      await member.setNickname(nextName, `Kayit ismi guncelle: ${actor.id}`).catch(() => {});
      await updateRegistrationName(guild.id, member.id, { icName: nextName, oocName: nextOoc });
      return { ok: true, nameUpdated: true, previous, icName: nextName, oocName: nextOoc };
    } catch (err) {
      return { ok: false, error: 'discord', detail: String(err?.message ?? err) };
    }
  }

  if (minAccountDays > 0) {
    const ageDays = (Date.now() - (member.user.createdTimestamp ?? Date.now())) / 86_400_000;
    if (ageDays < minAccountDays) return { ok: false, error: 'hesap_yeni', detail: `${Math.floor(ageDays)} gün` };
  }

  const kayitliId = await getRoleId(guild.id, 'kayitli');
  if (!kayitliId) return { ok: false, error: 'rol_yok' };

  const role = guild.roles.cache.get(kayitliId) ?? (await guild.roles.fetch(kayitliId).catch(() => null));
  if (!role) return { ok: false, error: 'rol_yok' };

  const me = guild.members.me;
  if (!me || me.roles.highest.position <= role.position) return { ok: false, error: 'bot_konum' };

  try {
    await markSanctioned({ guildId: guild.id, targetId: member.id, roleIds: [kayitliId] }).catch(() => {});
    if (!member.roles.cache.has(kayitliId)) await member.roles.add(kayitliId, `Kayit: ${actor.id}`);

    const kayitsizId = await getRoleId(guild.id, 'kayitsiz');
    if (kayitsizId && member.roles.cache.has(kayitsizId)) {
      await member.roles.remove(kayitsizId, `Kayit: ${actor.id}`).catch(() => {});
    }

    const nickname = String(icName).slice(0, 32);
    await member.setNickname(nickname, 'Kayit ismi').catch(() => {});

    await addRegistration({
      guildId: guild.id,
      userId: member.id,
      actorId: actor.id,
      actorTag,
      icName: nickname,
      oocName,
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'discord', detail: String(err?.message ?? err) };
  }
}

/** Kayitsiza atma: kayitli rolunu alir, kayitsiz verir. */
export async function unregisterMember(guild, { member, actor }) {
  const kayitliId = await getRoleId(guild.id, 'kayitli');
  const kayitsizId = await getRoleId(guild.id, 'kayitsiz');

  const me = guild.members.me;
  const kayitli = kayitliId ? guild.roles.cache.get(kayitliId) ?? (await guild.roles.fetch(kayitliId).catch(() => null)) : null;
  if (kayitli && me && me.roles.highest.position <= kayitli.position) return { ok: false, error: 'bot_konum' };

  try {
    if (kayitliId && member.roles.cache.has(kayitliId)) {
      await member.roles.remove(kayitliId, `Kayitsiza atma: ${actor.id}`);
    }
    if (kayitsizId && !member.roles.cache.has(kayitsizId)) {
      await markSanctioned({ guildId: guild.id, targetId: member.id, roleIds: [kayitsizId] }).catch(() => {});
      await member.roles.add(kayitsizId, `Kayitsiza atma: ${actor.id}`).catch(() => {});
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'discord', detail: String(err?.message ?? err) };
  }
}

/** Kullanicinin kayit kaydi var mi (panel akisi icin). */
export async function registrationOf(guildId, userId) {
  return getByUser(guildId, userId);
}
