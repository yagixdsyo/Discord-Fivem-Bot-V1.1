/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, list as listTemplate } from '../../../ui/templates/index.js';

export default {
  name: 'yetkili-istatistik',
  aliases: ['staff-stats'],
  description: 'Staff başına ceza islem istatistiklerini listeler.',
  category: 'Ceza ve Sicil',
  system: 'sicil',
  cooldown: 10,
  permission: { discord: [] },
  args: [],
  async run(ctx) {
    const lib = await import('../lib/cases.js');
    const t = ctx.t;
    const rows = await lib.staffStats(ctx.guild.id).catch(() => []);
    if (!rows.length) {
      await ctx.reply(listTemplate({ title: t('ceza.staff_stats_title'), lines: [t('ceza.staff_stats_empty')] }));
      return;
    }
    const lines = rows.map((x) => `<@${x.staffId}>: toplam ${x.total} | warn ${x.warn} kick ${x.kick} ban ${x.ban} jail ${x.jail}`);
    await ctx.reply(listTemplate({ title: t('ceza.staff_stats_title'), lines }));
  },
};
