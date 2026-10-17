/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from '../../../ui/templates/base.js';
import { button, row } from '../../../ui/v2.js';
import { cfxJoinLink } from './cfx.js';
import { getChannelId, getRoleId } from './maps.js';
import { getCfx, setPanelConfig, setStatus } from './state.js';
import { refreshStatusPanel, STATUS_STYLE } from './statusPanel.js';

function ts(iso) {
  const ms = Date.parse(iso ?? '');
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/** Duyuru kanalina durum kartini gonderir; rol pingi allowedMentions ile. */
export async function announceStatus(guild, t, { state, until = null, note = null, pingRoleId = null }) {
  const duyuruId = await getChannelId(guild.id, 'duyurular');
  if (!duyuruId) return false;
  const channel = guild.channels.cache.get(duyuruId) ?? (await guild.channels.fetch(duyuruId).catch(() => null));
  if (!channel || typeof channel.send !== 'function') return false;

  const style = STATUS_STYLE[state] ?? STATUS_STYLE.aktif;
  const cfx = await getCfx(guild.id);
  const lines = [t('fivem.status.duyuru_line', { durum: t(`fivem.status.state.${state}`) })];
  if (until && ts(until)) lines.push(t('fivem.status.until', { zaman: `<t:${ts(until)}:F>`, kalan: `<t:${ts(until)}:R>` }));
  if (note) lines.push(t('fivem.status.note', { not: note }));
  if (pingRoleId) lines.push(`<@&${pingRoleId}>`);

  const buttons = cfx.code
    ? [row([button({ label: t('fivem.status.quick_join'), url: cfxJoinLink(cfx.code), style: 'link', emojiKey: 'CFX' })])]
    : [];

  const payload = card({
    emojiKey: style.emoji,
    title: t('fivem.status.duyuru_title'),
    lines,
    buttons,
    accent: style.accent,
    footer: guild.name,
  });
  payload.allowedMentions = pingRoleId ? { roles: [pingRoleId] } : { parse: [] };

  await channel.send(payload).catch(() => {});
  return true;
}

/**
 * Durum degistirir, paneli gunceller (panel yoksa panel_durum kanalina kurar)
 * ve duyuruyu gonderir. ping=true ise oyuncu (whitelist) rolu pinglenir.
 */
export async function applyStatusChange(ctx, { state, until = null, note = null, ping = false }) {
  const t = ctx.t;
  const result = await setStatus(ctx.guild.id, state, { until, note, by: ctx.user.id, autoRevert: state !== 'kapali' });
  if (!result.ok) return { ok: false, error: 'db' };

  let panel = await refreshStatusPanel(ctx.guild, { t });
  if (panel.error === 'panel_yok') {
    const channelId = await getChannelId(ctx.guild.id, 'panel_durum');
    if (channelId) {
      await setPanelConfig(ctx.guild.id, { channelId });
      panel = await refreshStatusPanel(ctx.guild, { t });
    }
  }

  let pingRoleId = null;
  if (ping) pingRoleId = await getRoleId(ctx.guild.id, 'whitelist');
  await announceStatus(ctx.guild, t, { state, until, note, pingRoleId });

  return { ok: true, status: result.status, panel };
}
