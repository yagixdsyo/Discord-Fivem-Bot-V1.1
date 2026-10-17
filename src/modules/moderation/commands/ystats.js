/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { card } from '../../../ui/templates/base.js';
import { gallery } from '../../../ui/v2.js';
import { renderBarChart } from '../lib/renderers.js';
import { getUserDaily } from '../lib/stats.js';
import { formatSeconds, statsTextPayload } from '../lib/view.js';

export default {
  name: 'ystats',
  aliases: ['kstats', 'kullanıcı-stats'],
  description: 'Kullanıcı istatistiklerini gösterir (mesaj + ses).',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  args: [
    { name: 'kullanici', type: 'user', required: false, description: 'Kullanıcı (boşsa kendin)' },
    { name: 'gun', type: 'integer', required: false, description: 'Gün sayısı (varsayılan 7, en fazla 30)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const target = ctx.args.kullanici;
    const targetUser = target?.user ?? target ?? ctx.user;
    const days = Math.min(Math.max(1, ctx.args.gun ?? 7), 30);

    const daily = await getUserDaily(ctx.guild.id, targetUser.id, { days });
    const totals = daily.reduce(
      (acc, row) => {
        acc.messages += row.messages ?? 0;
        acc.voiceSeconds += row.voice_seconds ?? 0;
        return acc;
      },
      { messages: 0, voiceSeconds: 0 },
    );

    const png = renderBarChart({
      title: t('moderation.stats.user_title', { kullanici: targetUser.username }),
      subtitle: t('moderation.top.subtitle', { gun: days }),
      items: daily.map((row) => ({
        label: row.day,
        value: row.messages ?? 0,
        valueText: t('moderation.stats.value_text', {
          mesaj: row.messages ?? 0,
          ses: formatSeconds(row.voice_seconds ?? 0),
        }),
      })),
    });

    const totalsLine = t('moderation.stats.totals', {
      mesaj: totals.messages,
      ses: formatSeconds(totals.voiceSeconds),
    });

    if (png) {
      const fileName = `ystats-${targetUser.id}.png`;
      await ctx.reply(
        card({
          emojiKey: 'GRAFIK',
          title: t('moderation.stats.user_title', { kullanici: targetUser.username }),
          lines: [totalsLine],
          fileComponents: [gallery([`attachment://${fileName}`])],
          files: [new AttachmentBuilder(png, { name: fileName })],
          accent: 'primary',
        }),
      );
      return;
    }

    await ctx.reply(statsTextPayload(t, { daily, totals, days }));
  },
};
