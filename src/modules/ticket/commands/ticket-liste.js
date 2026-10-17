/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, list as listTemplate } from '../../../ui/templates/index.js';
import { createTranslator } from '../../../locales/index.js';

export default {
  name: 'ticket-liste',
  aliases: ['tickets'],
  description: 'Ticket listesini sayfali gosterir.',
  category: 'Ticket',
  system: 'ticket',
  cooldown: 5,
  permission: { discord: ['ManageChannels'] },
  args: [{ name: 'durum', type: 'string', required: false, description: 'acik|kapali|tumu' }],

  async run(ctx) {
    const t = ctx.t;
    const ticketLib = await import('../lib/tickets.js');
    const status = ctx.args.durum === 'kapali' ? 'kapali' : ctx.args.durum === 'acik' ? 'acik' : null;
    const items = await ticketLib.listTickets(ctx.guild.id, { status, limit: 25 });
    if (!items || !items.length) {
      await ctx.reply(errorTemplate(t('ticket.list_empty_title'), [t('ticket.list_empty')]));
      return;
    }
    const rows = items.map((d) => t('ticket.list_line', { id: d.ticket_id, kanal: d.channel_id ? `<#${d.channel_id}>` : '-', durum: d.status === 'acik' ? t('ticket.status_open') : t('ticket.status_closed'), kullanici: `<@${d.user_id}>`, tarih: `<t:${Math.floor(new Date(d.opened_at).getTime() / 1000)}:R>` }));
    await ctx.reply(listTemplate({ title: t('ticket.list_title'), lines: rows, footer: `Toplam: ${items.length}` }));
  },
};
