/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { createTranslator } from '../../../locales/index.js';

export default {
  name: 'ticket-puan',
  aliases: ['ticket-rating'],
  description: 'Ticket puan istatistiklerini goruntuler; staff icin puanlari sifirlar.',
  category: 'Ticket',
  system: 'ticket',
  cooldown: 5,
  permission: { discord: ['ManageChannels'] },
  args: [
    { name: 'islem', type: 'string', required: false, description: 'goruntule|sifirla' },
    { name: 'yetkili', type: 'user', required: false, description: 'Yetkili' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const ticketLib = await import('../lib/tickets.js');
    const islem = ctx.args.islem ?? 'goruntule';
    const arg = ctx.args.yetkili;
    const target = arg?.user ?? arg ?? null;

    if (islem === 'sifirla') {
      if (!target) {
        await ctx.reply(errorTemplate(t('ticket.puan_reset_no_target_title'), [t('ticket.puan_reset_no_target')]));
        return;
      }
      await resetTicketRatingsByStaff(ctx.guild.id, target.id).catch(() => {});
      await ctx.reply(success(t('ticket.puan_reset_title'), [t('ticket.puan_reset_done', { kullanici: `<@${target.id}>` })]));
      return;
    }

    const stats = await ticketLib.ticketRatingStats(ctx.guild.id, { staffId: target?.id ?? null });
    if (!stats || !stats.length) {
      await ctx.reply(errorTemplate(t('ticket.puan_empty_title'), [t('ticket.puan_empty')]));
      return;
    }
    const lines = stats.sort((a, b) => b.ortalama - a.ortalama).map((s) => t('ticket.puan_line', { yetkili: `<@${s.staff}>`, sayac: s.sayac, ortalama: s.ortalama.toFixed(1) }));
    await ctx.reply(success(t('ticket.puan_title'), lines));
  },
};

async function resetTicketRatingsByStaff(guildId, staffId) {
  const ticketLib = await import('../lib/tickets.js');
  const tickets = await ticketLib.listTickets(guildId, { status: 'kapali', limit: 500 });
  const targetTickets = tickets.filter((d) => d.closed_by === staffId || d.claimed_by === staffId).map((d) => d.ticket_id);
  const { getCollection, isDbReady } = await import('../../../db/index.js');
  if (isDbReady() && targetTickets.length) {
    await getCollection('ticket_ratings').deleteMany({ guild_id: guildId, ticket_id: { $in: targetTickets } });
  }
}
