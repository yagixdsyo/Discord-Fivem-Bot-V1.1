/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { StringSelectMenuBuilder, ActionRowBuilder } from 'discord.js';
import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { button, row } from '../../../ui/v2.js';
import { getChannelId } from '../lib/maps.js';
import { createPoll, pollResults, setPollMessage } from '../lib/rules.js';
import { pollPayload } from '../lib/view.js';

export function pollSelectRow(t, doc) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`oylama:sec:${doc.poll_id}`)
      .setPlaceholder(t('fivem.poll.select_placeholder'))
      .setMinValues(1)
      .setMaxValues(doc.multi ? Math.min(10, doc.options.length) : 1)
      .addOptions(doc.options.slice(0, 25).map((option, index) => ({ label: option.slice(0, 100), value: String(index) }))),
  );
}

export default {
  name: 'oylama',
  aliases: ['oylama-baslat'],
  description: 'Seçenekli oylama başlatır (tek veya çoklu seçim).',
  category: 'FiveM',
  system: null,
  cooldown: 10,
  permission: { discord: ['ManageMessages'] },
  args: [
    { name: 'soru', type: 'string', required: true, description: 'Oylama sorusu' },
    { name: 'süre', type: 'duration', required: false, description: 'Bitiş süresi (örn. 1sa)' },
    { name: 'çoklu', type: 'boolean', required: false, description: 'Çoklu seçim açık mı' },
    { name: 'kanal', type: 'channel', required: false, description: 'Yayın kanalı (varsayılan: oylama)' },
    { name: 'seçenekler', type: 'rest', required: true, description: 'Virgülle ayrılmış seçenekler' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const question = String(ctx.args.soru ?? '').trim();
    const options = String(ctx.args.seçenekler ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!question || options.length < 2) {
      await ctx.reply(errorTemplate(t('fivem.poll.invalid_title'), [t('fivem.poll.invalid')]));
      return;
    }
    if (options.length > 10) {
      await ctx.reply(errorTemplate(t('fivem.poll.too_many_title'), [t('fivem.poll.too_many')]));
      return;
    }

    const channelId = ctx.args.kanal?.id ?? (await getChannelId(ctx.guild.id, 'oylama')) ?? ctx.channelId;
    const channel = ctx.guild.channels.cache.get(channelId) ?? (await ctx.guild.channels.fetch(channelId).catch(() => null));
    if (!channel || typeof channel.send !== 'function') {
      await ctx.reply(errorTemplate(t('fivem.poll.channel_missing_title'), [t('fivem.poll.channel_missing')]));
      return;
    }

    const endsAt = ctx.args.süre?.ms ? new Date(Date.now() + ctx.args.süre.ms).toISOString() : null;
    const doc = await createPoll({
      guildId: ctx.guild.id,
      question,
      options,
      multi: ctx.args.çoklu === true,
      endsAt,
      ownerId: ctx.user.id,
      channelId: channel.id,
    });

    const results = pollResults(doc);
    const payload = card({
      emojiKey: 'GRAFIK',
      title: doc.question,
      lines: [
        t('fivem.poll.created', { secenek: `**${options.length}**`, tur: doc.multi ? t('fivem.poll.multi') : t('fivem.poll.single') }),
        ...results.map((result) => t('fivem.poll.line', { secenek: result.text, sayi: `**${result.count}**`, yuzde: `%${result.percent}`, cubuk: result.bar })),
        doc.ends_at ? t('fivem.poll.ends', { zaman: `<t:${Math.floor(Date.parse(doc.ends_at) / 1000)}:R>` }) : null,
      ].filter(Boolean),
      accent: 'primary',
      buttons: [
        pollSelectRow(t, doc),
        row([button({ id: `oylama:kapat:${doc.poll_id}:${ctx.user.id}`, label: t('fivem.poll.close'), emojiKey: 'KILIT', style: 'secondary' })]),
      ],
      footer: t('fivem.poll.hint'),
    });

    const message = await channel.send(payload).catch(() => null);
    if (!message) {
      await ctx.reply(errorTemplate(t('fivem.poll.post_fail_title'), [t('fivem.poll.post_fail')]));
      return;
    }
    await setPollMessage(ctx.guild.id, doc.poll_id, { channelId: channel.id, messageId: message.id });

    await ctx.reply(
      success(t('fivem.poll.started_title'), [
        t('fivem.poll.started', { kanal: `<#${channel.id}>`, kod: `\`${doc.poll_id}\`` }),
      ]),
    );
  },
};
