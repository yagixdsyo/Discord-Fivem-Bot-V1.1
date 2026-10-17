/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { card } from '../../../ui/templates/base.js';
import { gallery } from '../../../ui/v2.js';
import { renderBarChart } from '../lib/renderers.js';
import { topUsers } from '../lib/stats.js';
import { formatSeconds, topPayload } from '../lib/view.js';

export default {
  name: 'top',
  aliases: ['liderlik'],
  description: 'Mesaj/ses liderlik tablosunu gösterir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  args: [
    {
      name: 'tur',
      type: 'choice',
      required: false,
      description: 'Ölçüt',
      choices: [
        { name: 'Mesaj', value: 'mesaj' },
        { name: 'Ses', value: 'ses' },
      ],
    },
    { name: 'gun', type: 'integer', required: false, description: 'Gün sayısı (varsayılan 7)' },
    { name: 'adet', type: 'integer', required: false, description: 'Kişi sayısı (varsayılan 10, en fazla 25)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const tur = ctx.args.tur ?? 'mesaj';
    const days = Math.min(Math.max(1, ctx.args.gun ?? 7), 30);
    const limit = Math.min(Math.max(1, ctx.args.adet ?? 10), 25);

    const rows = await topUsers(ctx.guild.id, {
      metric: tur === 'ses' ? 'voice' : 'messages',
      days,
      limit,
    });

    const labels = new Map();
    await Promise.all(
      rows.map(async (row) => {
        const member = ctx.guild.members.cache.get(row.user_id);
        if (member) {
          labels.set(row.user_id, member.displayName ?? member.user?.username ?? row.user_id);
          return;
        }
        const user = await ctx.client.users.fetch(row.user_id).catch(() => null);
        labels.set(row.user_id, user?.username ?? row.user_id);
      }),
    );

    const metricText = (row) =>
      tur === 'ses'
        ? t('moderation.top.voice_value', { deger: formatSeconds(row.voice_seconds) })
        : t('moderation.top.message_value', { deger: row.messages });

    const png = renderBarChart({
      title: tur === 'ses' ? t('moderation.top.voice_title') : t('moderation.top.title'),
      subtitle: t('moderation.top.subtitle', { gun: days }),
      items: rows.map((row) => ({
        label: labels.get(row.user_id) ?? row.user_id,
        value: tur === 'ses' ? row.voice_seconds : row.messages,
        valueText: tur === 'ses' ? formatSeconds(row.voice_seconds) : String(row.messages),
      })),
    });

    if (png) {
      const fileName = 'top.png';
      await ctx.reply(
        card({
          emojiKey: 'LEADERBOARD',
          title: tur === 'ses' ? t('moderation.top.voice_title') : t('moderation.top.title'),
          lines: [t('moderation.top.caption', { gun: days })],
          fileComponents: [gallery([`attachment://${fileName}`])],
          files: [new AttachmentBuilder(png, { name: fileName })],
          accent: 'primary',
        }),
      );
      return;
    }

    await ctx.reply(topPayload(t, { rows, metricText, days }));
  },
};
