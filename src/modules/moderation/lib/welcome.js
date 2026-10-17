/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { getGuildConfig, setGuildSetting } from '../../../core/guildSettings.js';
import { createTranslator } from '../../../locales/index.js';
import { getColor } from '../../../ui/colors.js';
import { brandFooter, container, gallery, payload, text, titleLine } from '../../../ui/v2.js';
import { renderWelcomePng, renderGoodbyePng } from '../../../ui/canvas/cards.js';

const WELCOME_KEY = 'welcome';
const AUTOROLE_KEY = 'autorole';

const DEFAULT_MESSAGE = 'Hoş geldin {kullanici}! **{sunucu}** sunucusuna katıldın. Üye sayısı: **{uye}**';
const DEFAULT_BYE_MESSAGE = 'Görüşürüz {kullanici}! **{sunucu}** sunucusundan ayrıldın.';

export async function getWelcomeConfig(guildId) {
  try {
    const config = await getGuildConfig(guildId);
    const welcome = config?.settings?.[WELCOME_KEY] ?? {};
    const autorole = config?.settings?.[AUTOROLE_KEY] ?? {};
    return {
      channelId: welcome.channelId ?? null,
      dm: welcome.dm !== false,
      message:
        typeof welcome.message === 'string' && welcome.message.trim().length > 0
          ? welcome.message
          : DEFAULT_MESSAGE,
      byeChannelId: welcome.byeChannelId ?? null,
      byeMessage:
        typeof welcome.byeMessage === 'string' && welcome.byeMessage.trim().length > 0
          ? welcome.byeMessage
          : DEFAULT_BYE_MESSAGE,
      autoroleId: autorole.roleId ?? null,
      language: config?.language ?? 'tr',
    };
  } catch {
    return {
      channelId: null,
      dm: true,
      message: DEFAULT_MESSAGE,
      byeChannelId: null,
      byeMessage: DEFAULT_BYE_MESSAGE,
      autoroleId: null,
      language: 'tr',
    };
  }
}

export async function setWelcomeConfig(guildId, patch = {}) {
  const current = await getWelcomeConfig(guildId);
  const merged = {
    channelId: patch.channelId !== undefined ? patch.channelId : current.channelId,
    dm: patch.dm !== undefined ? Boolean(patch.dm) : current.dm,
    message: patch.message !== undefined ? patch.message : current.message,
    byeChannelId: patch.byeChannelId !== undefined ? patch.byeChannelId : current.byeChannelId,
    byeMessage: patch.byeMessage !== undefined ? patch.byeMessage : current.byeMessage,
  };
  const ok = await setGuildSetting(guildId, WELCOME_KEY, merged);
  if (patch.autoroleId !== undefined) {
    await setGuildSetting(guildId, AUTOROLE_KEY, { roleId: patch.autoroleId });
  }
  return ok;
}

function renderTemplate(template, member) {
  return String(template)
    .replaceAll('{kullanici}', `<@${member.id}>`)
    .replaceAll('{sunucu}', member.guild.name)
    .replaceAll('{uye}', String(member.guild.memberCount ?? member.guild.members.cache.size ?? 0));
}

/** Uye karti payload'u: canvas varsa galeri, yoksa duz V2 karti. */
function buildMemberPayload({ png, fileName, textContent, emojiKey, title, accent }) {
  if (png) {
    return {
      payload: payload({
        components: [
          container([text(titleLine(emojiKey, title)), text(textContent), gallery([`attachment://${fileName}`]), text(brandFooter())], {
            accentColor: accent,
          }),
        ],
        files: [new AttachmentBuilder(png, { name: fileName })],
      }),
      hasFile: true,
    };
  }
  return {
    payload: payload({
      components: [container([text(titleLine(emojiKey, title)), text(textContent), text(brandFooter())], { accentColor: accent })],
    }),
    hasFile: false,
  };
}

/**
 * Hos geldin kartini kanala ve/veya DM'e gonderir.
 * @returns {Promise<{ok: boolean, channel: boolean, dm: boolean}>}
 */
export async function sendWelcome(member, config = null) {
  const cfg = config ?? (await getWelcomeConfig(member.guild.id));
  const t = createTranslator(cfg.language ?? 'tr');
  const textContent = renderTemplate(cfg.message, member);
  const png = await renderWelcomePng({
    tag: member.user?.username ?? member.id,
    subtitle: t('moderation.welcome.canvas_subtitle', { sunucu: member.guild.name }),
    metaLine: t('moderation.welcome.canvas_member', { sayi: member.guild.memberCount ?? 0 }),
    avatarUrl: member.user?.displayAvatarURL?.({ extension: 'png', size: 256 }) ?? null,
    accent: getColor('primary'),
  });

  const result = { ok: false, channel: false, dm: false };
  const built = buildMemberPayload({
    png,
    fileName: `hosgeldin-${member.id}.png`,
    textContent,
    emojiKey: 'HOSGELDIN',
    title: t('moderation.welcome.title'),
    accent: getColor('primary'),
  });

  if (cfg.channelId) {
    try {
      const channel =
        member.guild.channels.cache.get(cfg.channelId) ??
        (await member.guild.channels.fetch(cfg.channelId).catch(() => null));
      if (channel?.isTextBased?.()) {
        await channel.send(built.payload);
        result.channel = true;
      }
    } catch {
      /* kanal gonderimi basarisiz */
    }
  }

  if (cfg.dm) {
    try {
      await member.send(built.payload);
      result.dm = true;
    } catch {
      /* DM kapali olabilir */
    }
  }

  result.ok = result.channel || result.dm;
  return result;
}

/**
 * Gule gule kartini veda kanalina gonderir (ayarliysa).
 * @returns {Promise<{ok: boolean, channel: boolean}>}
 */
export async function sendGoodbye(member, config = null) {
  const cfg = config ?? (await getWelcomeConfig(member.guild.id));
  if (!cfg.byeChannelId) return { ok: false, channel: false };
  const t = createTranslator(cfg.language ?? 'tr');
  const textContent = renderTemplate(cfg.byeMessage, member);
  const png = await renderGoodbyePng({
    tag: member.user?.username ?? member.id,
    subtitle: t('moderation.welcome.bye_canvas_subtitle', { sunucu: member.guild.name }),
    metaLine: t('moderation.welcome.canvas_member', { sayi: member.guild.memberCount ?? 0 }),
    avatarUrl: member.user?.displayAvatarURL?.({ extension: 'png', size: 256 }) ?? null,
  });

  const built = buildMemberPayload({
    png,
    fileName: `gulegule-${member.id}.png`,
    textContent,
    emojiKey: 'CEVRIMICI',
    title: t('moderation.welcome.bye_title'),
    accent: getColor('error'),
  });

  try {
    const channel =
      member.guild.channels.cache.get(cfg.byeChannelId) ??
      (await member.guild.channels.fetch(cfg.byeChannelId).catch(() => null));
    if (channel?.isTextBased?.()) {
      await channel.send(built.payload);
      return { ok: true, channel: true };
    }
  } catch {
    /* kanal gonderimi basarisiz */
  }
  return { ok: false, channel: false };
}

/** Oto-rol uygular (bot hiyerarsisi guvenli). */
export async function applyAutorole(member, roleId) {
  if (!roleId) return false;
  try {
    const role = member.guild.roles.cache.get(roleId);
    if (!role || role.managed) return false;
    const me = member.guild.members.me;
    if (!me || me.roles.highest.position <= role.position) return false;
    await member.roles.add(role.id, 'Oto-rol');
    return true;
  } catch {
    return false;
  }
}
