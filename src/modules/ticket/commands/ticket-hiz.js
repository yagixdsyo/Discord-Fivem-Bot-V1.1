/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, list as listTemplate } from '../../../ui/templates/index.js';

export default {
  name: 'ticket-hiz',
  aliases: ['ticket-speed'],
  description: 'Yetkili ticket sahiplenme sure istatistiklerini goruntuler.',
  category: 'Ticket',
  system: 'ticket',
  cooldown: 5,
  permission: { discord: ['ManageChannels'] },
  args: [{ name: 'yetkili', type: 'user', required: false, description: 'Filtrelenecek yetkili' }],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/tickets.js');
    const arg = ctx.args.yetkili;
    const target = arg?.user ?? arg ?? null;
    const stats = await lib.ticketSpeedStats(ctx.guild.id, { staffId: target?.id ?? null });
    if (!stats.length) {
      await ctx.reply(errorTemplate(t('ticket.speed_empty_title'), [t('ticket.speed_empty')]));
      return;
    }
    const lines = stats.map((s) => t('ticket.speed_line', { yetkili: `<@${s.staff}>`, adet: s.adet, ort: s.ortalamaSn.toFixed(1), en: s.enHizliSn.toFixed(1) }));
    await ctx.reply(listTemplate({ title: t('ticket.speed_title'), lines }));
  },
};
