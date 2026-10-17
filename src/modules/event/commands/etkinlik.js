/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { button, row } from '../../../ui/v2.js';
import { createTranslator } from '../../../locales/index.js';

function parseDate(value) {
  const match = String(value ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Etkinlik panelini (yeniden) uretir; katilim ozeti eklenebilir. */
export function buildEventPanel(t, doc, extraLines = []) {
  const startsAt = new Date(doc.starts_at);
  return card({
    emojiKey: 'ETKINLIK',
    title: `${doc.title} (${doc.event_id})`,
    lines: [
      doc.description,
      t('event.starts_at', { zaman: `<t:${Math.floor(startsAt.getTime() / 1000)}:F>` }),
      doc.capacity ? t('event.capacity', { sayi: doc.capacity }) : null,
      ...extraLines,
      t('event.how_join'),
    ].filter(Boolean),
    accent: 'primary',
    buttons: [row([
      button({ id: `etkinlik:katil:${doc.event_id}`, label: t('event.btn_join'), emojiKey: 'EKLE', style: 'primary' }),
      button({ id: `etkinlik:belki:${doc.event_id}`, label: t('event.btn_maybe'), emojiKey: 'BEKLE', style: 'secondary' }),
      button({ id: `etkinlik:cik:${doc.event_id}`, label: t('event.btn_leave'), emojiKey: 'CIKAR', style: 'danger' }),
      button({ id: `etkinlik:durum:${doc.event_id}`, label: t('event.btn_status'), emojiKey: 'YENILE', style: 'secondary' }),
    ])],
  });
}

export default {
  name: 'etkinlik',
  aliases: ['event'],
  description: 'Etkinlik olustur, bitir, listele.',
  category: 'Etkinlik',
  system: 'etkinlik',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'islem', type: 'string', required: true, description: 'olustur|bitir|liste' },
    { name: 'baslik', type: 'string', required: false, description: 'Baslik' },
    { name: 'tarih', type: 'string', required: false, description: 'YYYY-MM-DD HH:MM' },
    { name: 'kontenjan', type: 'number', required: false, description: 'Kontenjan' },
    { name: 'aciklama', type: 'rest', required: false, description: 'Aciklama' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/events.js');
    const islem = String(ctx.args.islem || '').toLowerCase();
    if (islem === 'liste') {
      const rows = await lib.listEvents(ctx.guild.id);
      const lines = rows.map((e) => `${e.event_id} — ${e.title} (${e.status}) — <t:${Math.floor(new Date(e.starts_at).getTime() / 1000)}:F>`);
      await ctx.reply(listTemplate({ title: t('event.list_title'), lines: lines.length ? lines : [t('event.list_empty')] }));
      return;
    }
    if (islem === 'bitir') {
      const id = String(ctx.args.baslik || '').trim();
      if (!id) { await ctx.reply(errorTemplate(t('event.id_need_title'), [t('event.id_need')])); return; }
      await lib.finishEvent(ctx.guild.id, id);
      const doc = await lib.getEvent(ctx.guild.id, id);
      const lines = await lib.buildParticipantsText(doc);
      await ctx.reply(success(t('event.finished_title'), [t('event.finished_line'), ...lines]));
      return;
    }
    if (islem !== 'olustur') {
      await ctx.reply(errorTemplate(t('event.bad_action_title'), [t('event.bad_action')]));
      return;
    }
    const baslik = String(ctx.args.baslik || '').trim();
    const tarih = parseDate(ctx.args.tarih || '');
    const capacity = Number(ctx.args.kontenjan) || null;
    const desc = String(ctx.args.aciklama || '').trim() || null;
    if (!baslik || !tarih) {
      await ctx.reply(errorTemplate(t('event.create_invalid_title'), [t('event.create_invalid')]));
      return;
    }
    // etkinlik yasagi olanlar katilamaz; banned list per guild.
    const banned = (await import('../../fivem/lib/state.js')).getSetting ? ((await (await import('../../fivem/lib/state.js')).getSetting(ctx.guild.id, 'event.bans')) ?? []).map(String) : [];
    void banned;
    const doc = await lib.createEvent({ guildId: ctx.guild.id, creatorId: ctx.user.id, title: baslik, description: desc, startsAt: tarih, capacity, channelIds: [ctx.channel.id] });
    const message = await ctx.channel.send(buildEventPanel(t, doc));
    await ctx.reply(success(t('event.created_title'), [t('event.created', { id: doc.event_id, mesaj: `<#${message.channelId}>` })]));
    refreshParticipantSummary(t, ctx.channel, lib, doc, message).catch(() => {});
    // hatirlatma periyotlari: 30 dk / 5 dk / baslangic
    setTimeout(() => {
      interactionReminder(ctx.channel, doc, 'event.remind_30').catch(() => {});
    }, Math.max(1000, tarih.getTime() - Date.now() - 1800000));
    setTimeout(() => {
      interactionReminder(ctx.channel, doc, 'event.remind_5').catch(() => {});
    }, Math.max(1000, tarih.getTime() - Date.now() - 300000));
    setTimeout(() => {
      interactionReminder(ctx.channel, doc, 'event.remind_start').catch(() => {});
    }, Math.max(1000, tarih.getTime() - Date.now()));
  },
};

/**
 * Katilim ozetini panelin TAMAMINI yeniden ureterek gunceller.
 * (Eski surum V2 mesaji `{ content }` ile duzenlemeye calisiyordu; Discord
 * V2 mesajlari content ile duzenlenemez, bu yuzden ozet hic gorunmuyordu.)
 */
async function refreshParticipantSummary(t, channel, lib, doc, message) {
  const latest = await lib.getEvent(channel.guild.id, doc.event_id);
  const summary = await lib.buildParticipantsText(latest);
  try { await message.edit(buildEventPanel(t, latest, summary)); } catch {}
}

function interactionReminder(channel, doc, key) {
  const t = createTranslator();
  return channel.send(card({
    emojiKey: 'ETKINLIK',
    title: t('event.remind_title'),
    lines: [t(key, { baslik: doc.title })],
    accent: 'warn',
  })).catch(() => {});
}
