/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { performanceStats } from '../lib/incidents.js';
import { guardPerformansPayload } from '../lib/view.js';

export default {
  name: 'guard-performans',
  aliases: ['guardperformans'],
  description: 'Guard ceza/geri alma sürelerini ve olay sayılarını gösterir.',
  category: 'Guard',
  system: 'guard',
  cooldown: 10,
  permission: { discord: ['Administrator'] },
  args: [{ name: 'gun', type: 'integer', required: false, description: 'Kaç günlük veri (varsayılan 7)' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const days = Math.min(Math.max(Number(ctx.args.gun) || 7, 1), 30);
    const result = await performanceStats(ctx.guild.id, { days });
    await ctx.reply(
      guardPerformansPayload(t, {
        days,
        stats: result.stats,
        total: result.total,
        safeCount: result.safeCount,
        undoneCount: result.undoneCount,
        byModule: result.byModule,
      }),
    );
  },
};
