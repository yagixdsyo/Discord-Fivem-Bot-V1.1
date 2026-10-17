/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from '../../../ui/templates/base.js';
import { button, row } from '../../../ui/v2.js';
import { createTranslator } from '../../../locales/index.js';
import { cfxJoinLink, fetchServerInfo } from './cfx.js';
import { getCfx, getPanelConfig, getStatus, setPanelConfig } from './state.js';

const STATUS_STYLE = {
  aktif: { emoji: 'DURUM_AKTIF', accent: 'success' },
  bakim: { emoji: 'DURUM_BAKIM', accent: 'warn' },
  restart: { emoji: 'DURUM_RESTART', accent: 'warn' },
  kapali: { emoji: 'DURUM_KAPALI', accent: 'error' },
};

export { STATUS_STYLE };

function ts(iso) {
  const ms = Date.parse(iso ?? '');
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/**
 * Durum paneli kartini uretir.
 * @param {Function} t
 * @param {{status: object, cfx: object, info: object|null, guildName: string}} opts
 */
export function buildStatusPayload(t, { status, cfx, info, guildName }) {
  const style = STATUS_STYLE[status.state] ?? STATUS_STYLE.aktif;
  const lines = [t('fivem.status.current', { durum: t(`fivem.status.state.${status.state}`) })];

  if (status.until) {
    const until = ts(status.until);
    if (until) lines.push(t('fivem.status.until', { zaman: `<t:${until}:F>`, kalan: `<t:${until}:R>` }));
  }
  if (status.note) lines.push(t('fivem.status.note', { not: status.note }));

  if (info?.ok) {
    lines.push(t('fivem.status.players', { oyuncu: info.players, maks: info.maxPlayers }));
  } else if (cfx.code) {
    lines.push(t('fivem.status.server_offline'));
  }
  if (cfx.ip) lines.push(t('fivem.status.ip', { ip: `\`${cfx.ip}\`` }));

  const updated = ts(status.updatedAt);
  lines.push(
    updated
      ? t('fivem.status.updated', {
          zaman: `<t:${updated}:R>`,
          kisi: status.updatedBy ? `<@${status.updatedBy}>` : t('fivem.status.system'),
        })
      : t('fivem.status.updated_unknown'),
  );

  const buttons = [];
  if (cfx.code) {
    buttons.push(
      row([button({ label: t('fivem.status.quick_join'), url: cfxJoinLink(cfx.code), style: 'link', emojiKey: 'CFX' })]),
    );
  }

  return card({
    emojiKey: style.emoji,
    title: t('fivem.status.title'),
    lines,
    buttons,
    accent: style.accent,
    footer: guildName ?? null,
  });
}

/**
 * Paneli yeniler: mesaj varsa duzenler, yoksa gonderip kaydeder.
 * @returns {Promise<{ok: boolean, updated?: boolean, posted?: boolean, error?: string}>}
 */
export async function refreshStatusPanel(guild, { t = createTranslator(), repost = false } = {}) {
  const panel = await getPanelConfig(guild.id);
  if (!panel.channelId) return { ok: false, error: 'panel_yok' };

  const status = await getStatus(guild.id);
  const cfx = await getCfx(guild.id);
  let info = null;
  if (cfx.code) info = await fetchServerInfo(cfx.code).catch(() => null);
  const payload = buildStatusPayload(t, { status, cfx, info, guildName: guild.name });

  const channel =
    guild.channels.cache.get(panel.channelId) ?? (await guild.channels.fetch(panel.channelId).catch(() => null));
  if (!channel) return { ok: false, error: 'kanal_yok' };

  if (panel.messageId && !repost) {
    const message = await channel.messages.fetch(panel.messageId).catch(() => null);
    if (message) {
      await message.edit(payload).catch(() => {});
      return { ok: true, updated: true };
    }
  }

  const sent = await channel.send(payload);
  await setPanelConfig(guild.id, { channelId: channel.id, messageId: sent.id });
  return { ok: true, posted: true };
}
