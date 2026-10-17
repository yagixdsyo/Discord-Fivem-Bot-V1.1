/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { card } from '../../../ui/templates/base.js';
import { gallery } from '../../../ui/v2.js';
import { renderBarChart } from '../lib/renderers.js';
import { getServerDaily } from '../lib/stats.js';
import { formatSeconds, statsTextPayload } from '../lib/view.js';

export default {
  name: 'stats',
  aliases: ['sunucu-stats'],
  description: 'Sunucu istatistiklerini gösterir (mesaj + ses).',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  args: [{ name: 'gun', type: 'integer', required: false, description: 'Gün sayısı (varsayılan 14, en fazla 30)' }],

  async run(ctx) {
    const t = ctx.t;
    const days = Math.min(Math.max(1, ctx.args.gun ?? 14), 30);

    const daily = await getServerDaily(ctx.guild.id, { days });
    const totals = daily.reduce(
      (acc, row) => {
        acc.messages += row.messages ?? 0;
        acc.voiceSeconds += row.voice_seconds ?? 0;
        return acc;
      },
      { messages: 0, voiceSeconds: 0 },
    );

    const png = renderBarChart({
      title: t('moderation.stats.title'),
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
      const fileName = 'stats.png';
      await ctx.reply(
        card({
          emojiKey: 'GRAFIK',
          title: t('moderation.stats.title'),
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
