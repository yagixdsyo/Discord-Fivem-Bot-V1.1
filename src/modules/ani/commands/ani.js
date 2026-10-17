/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card, error as errorTemplate, success, list as listTemplate } from '../../../ui/templates/index.js';
import { button, row } from '../../../ui/v2.js';

function parseDetailFlags(raw) {
  const flags = { baslik: null, etiket: [], link: null };
  const re = /(baslik|etiket|link):\s*(.*?)(?=\s*(?:baslik|etiket|link):|$)/gi;
  for (const match of String(raw).matchAll(re)) {
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === 'baslik') flags.baslik = value;
    else if (key === 'link') flags.link = value;
    else flags.etiket = value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8);
  }
  const content = String(raw).replace(re, ' ').replace(/\s+/g, ' ').trim();
  return { ...flags, content };
}

function ts(dateLike) {
  return Math.floor(new Date(dateLike).getTime() / 1000);
}

function momentLines(t, moment) {
  const lines = [`**${moment.title}**`];
  if (moment.content) lines.push(moment.content);
  if ((moment.tags ?? []).length > 0) lines.push(t('ani.tags_line', { etiketler: moment.tags.map((x) => `\`${x}\``).join(' ') }));
  if (moment.link) lines.push(t('ani.link_line', { link: moment.link }));
  lines.push(t('ani.meta_line', { oneren: `<@${moment.proposed_by}>`, tarih: `<t:${ts(moment.approved_at ?? moment.created_at)}:d>` }));
  return lines;
}

export default {
  name: 'ani',
  aliases: ['ani-arsiv'],
  description: 'Topluluk anilarini onerir, arsivler, arar ve raporlar.',
  category: 'Topluluk',
  system: 'ani',
  cooldown: 5,
  permission: { discord: [] },
  args: [
    { name: 'islem', type: 'string', required: true, description: 'oneri|ara|bu-ay|yil-ozeti|liste|onayla|reddet|ayar' },
    { name: 'parametre', type: 'rest', required: false, description: 'Isleme gore parametreler' },
  ],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/moments.js');
    const islem = String(ctx.args.islem || '').toLowerCase();
    const raw = String(ctx.args.parametre || '').trim();
    const isStaff = Boolean(ctx.member?.permissions?.has?.('ManageMessages'));

    if (islem === 'oneri' || islem === 'öneri') {
      const parsed = parseDetailFlags(raw);
      const content = parsed.content || parsed.baslik;
      if (!content) {
        await ctx.reply(errorTemplate(t('ani.propose_input_title'), [t('ani.propose_input')], { ephemeral: true }));
        return;
      }
      const moment = await lib.createMoment({
        guildId: ctx.guild.id,
        title: parsed.baslik ?? content.slice(0, 80),
        content,
        tags: parsed.etiket,
        link: parsed.link,
        proposedBy: ctx.user.id,
      });

      const cfg = await lib.getConfig(ctx.guild.id);
      if (cfg.reviewChannelId) {
        const channel = await ctx.client.channels.fetch(cfg.reviewChannelId).catch(() => null);
        if (channel) {
          await channel.send(card({
            emojiKey: 'BELGE',
            title: t('ani.review_card_title'),
            subtitle: `#${moment.moment_id}`,
            accent: 'info',
            lines: momentLines(t, moment),
            buttons: [row([
              button({ id: `ani:onayla:${moment.moment_id}`, label: t('ani.btn_approve'), style: 'success' }),
              button({ id: `ani:reddet:${moment.moment_id}`, label: t('ani.btn_reject'), style: 'danger' }),
            ])],
            footer: t('ani.review_card_footer'),
          })).catch(() => {});
        }
      }

      await ctx.reply(success(t('ani.proposed_title'), [
        t('ani.proposed', { id: moment.moment_id }),
        t('ani.proposed_hint'),
      ], { ephemeral: true }));
      return;
    }

    if (islem === 'ara' || islem === 'search') {
      if (!raw) {
        await ctx.reply(errorTemplate(t('ani.search_input_title'), [t('ani.search_input')], { ephemeral: true }));
        return;
      }
      const rows = await lib.searchMoments(ctx.guild.id, raw);
      const lines = rows.map((m) => t('ani.search_line', { id: m.moment_id, baslik: m.title, oneren: `<@${m.proposed_by}>` }));
      await ctx.reply(lines.length > 0
        ? listTemplate({ title: t('ani.search_title', { kelime: raw }), lines, footer: t('ani.search_footer', { adet: rows.length }) })
        : success(t('ani.search_empty_title'), [t('ani.search_empty', { kelime: raw })]));
      return;
    }

    if (islem === 'bu-ay' || islem === 'buay') {
      const monthKey = new Date().toISOString().slice(0, 7);
      const report = await lib.monthlyReport(ctx.guild.id, monthKey);
      const lines = report.rows.slice(0, 15).flatMap((m) => [`**${m.title}** — <@${m.proposed_by}>`]);
      await ctx.reply(card({
        emojiKey: 'BELGE',
        title: t('ani.month_title', { ay: monthKey }),
        lines: [
          t('ani.report_summary', { adet: report.count, katilimci: report.contributorCount }),
          ...(report.topTags.length > 0 ? [t('ani.report_tags', { etiketler: report.topTags.map(([tag, n]) => `${tag} (${n})`).join(', ') })] : []),
        ],
        sections: lines.length > 0 ? [{ separator: true }, ...lines] : [],
      }));
      return;
    }

    if (islem === 'yil-ozeti' || islem === 'yil') {
      const year = Number(raw) || new Date().getFullYear();
      const report = await lib.yearlyReport(ctx.guild.id, year);
      await ctx.reply(card({
        emojiKey: 'BELGE',
        title: t('ani.year_title', { yil: year }),
        lines: [
          t('ani.report_summary', { adet: report.count, katilimci: report.contributorCount }),
          ...(report.topTags.length > 0 ? [t('ani.report_tags', { etiketler: report.topTags.map(([tag, n]) => `${tag} (${n})`).join(', ') })] : []),
          ...report.rows.slice(0, 10).map((m) => `- **${m.title}** — <t:${ts(m.approved_at ?? m.created_at)}:d>`),
        ],
      }));
      return;
    }

    if (islem === 'liste') {
      if (!isStaff) {
        await ctx.reply(errorTemplate(t('ani.staff_only_title'), [t('ani.staff_only')], { ephemeral: true }));
        return;
      }
      const rows = await lib.pendingMoments(ctx.guild.id, 5);
      if (rows.length === 0) {
        await ctx.reply(success(t('ani.pending_empty_title'), [t('ani.pending_empty')]));
        return;
      }
      const lines = rows.map((m) => t('ani.pending_line', { id: m.moment_id, baslik: m.title, oneren: `<@${m.proposed_by}>` }));
      const extraRows = rows.map((m) => row([
        button({ id: `ani:onayla:${m.moment_id}`, label: t('ani.btn_approve'), style: 'success' }),
        button({ id: `ani:reddet:${m.moment_id}`, label: t('ani.btn_reject'), style: 'danger' }),
      ]));
      await ctx.reply(listTemplate({ title: t('ani.pending_title'), lines, extraRows, showPageButtons: false }));
      return;
    }

    if (islem === 'onayla' || islem === 'reddet') {
      if (!isStaff) {
        await ctx.reply(errorTemplate(t('ani.staff_only_title'), [t('ani.staff_only')], { ephemeral: true }));
        return;
      }
      const [momentId, ...reasonParts] = raw.split(/\s+/);
      const approved = islem === 'onayla';
      const result = await lib.reviewMoment({
        guildId: ctx.guild.id,
        momentId,
        reviewerId: ctx.user.id,
        approved,
        reason: reasonParts.join(' ') || null,
      });
      if (!result.ok) {
        await ctx.reply(errorTemplate(t('ani.review_fail_title'), [t('ani.review_fail')]));
        return;
      }
      if (approved) {
        const cfg = await lib.getConfig(ctx.guild.id);
        if (cfg.archiveChannelId) {
          const channel = await ctx.client.channels.fetch(cfg.archiveChannelId).catch(() => null);
          if (channel) {
            await channel.send(card({
              emojiKey: 'BELGE',
              title: t('ani.archive_card_title'),
              subtitle: `#${momentId}`,
              accent: 'success',
              lines: momentLines(t, result.moment),
            })).catch(() => {});
          }
        }
      }
      await ctx.reply(success(t('ani.review_done_title'), [t(approved ? 'ani.review_approved' : 'ani.review_rejected', { id: momentId })], { ephemeral: true }));
      return;
    }

    if (islem === 'ayar') {
      if (!isStaff) {
        await ctx.reply(errorTemplate(t('ani.staff_only_title'), [t('ani.staff_only')], { ephemeral: true }));
        return;
      }
      const [setting, ...restParts] = raw.split(/\s+/);
      const value = restParts.join(' ').trim();
      const channelId = value.match(/<#(\d+)>/)?.[1] ?? (/^\d+$/.test(value) ? value : null);
      if (setting === 'arsiv' && channelId) {
        const cfg = await lib.setConfig(ctx.guild.id, { archiveChannelId: channelId });
        await ctx.reply(success(t('ani.config_updated_title'), [t('ani.config_archive', { kanal: `<#${cfg.archiveChannelId}>` })], { ephemeral: true }));
        return;
      }
      if (setting === 'inceleme' && channelId) {
        const cfg = await lib.setConfig(ctx.guild.id, { reviewChannelId: channelId });
        await ctx.reply(success(t('ani.config_updated_title'), [t('ani.config_review', { kanal: `<#${cfg.reviewChannelId}>` })], { ephemeral: true }));
        return;
      }
      if (!setting || setting === 'goster') {
        const cfg = await lib.getConfig(ctx.guild.id);
        await ctx.reply(card({
          emojiKey: 'AYAR',
          title: t('ani.config_title'),
          lines: [
            t('ani.config_archive', { kanal: cfg.archiveChannelId ? `<#${cfg.archiveChannelId}>` : t('ani.config_none') }),
            t('ani.config_review', { kanal: cfg.reviewChannelId ? `<#${cfg.reviewChannelId}>` : t('ani.config_none') }),
          ],
          footer: t('ani.config_footer'),
        }));
        return;
      }
      await ctx.reply(errorTemplate(t('ani.config_invalid_title'), [t('ani.config_invalid')], { ephemeral: true }));
      return;
    }

    await ctx.reply(errorTemplate(t('ani.unknown_title'), [t('ani.unknown_action')]));
  },
};
