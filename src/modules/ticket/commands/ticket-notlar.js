/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, list as listTemplate } from '../../../ui/templates/index.js';

export default {
  name: 'ticket-notlar',
  aliases: ['ticket-notes'],
  description: 'Ticket notlarini gosterir (yetkililere özel).',
  category: 'Ticket',
  system: 'ticket',
  cooldown: 3,
  permission: { discord: ['ManageChannels'] },
  args: [],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/tickets.js');
    const doc = await lib.getTicketByChannel(ctx.channel.id);
    if (!doc) {
      await ctx.reply(errorTemplate(t('ticket.not_found_title'), [t('ticket.not_found')]));
      return;
    }
    const notes = await lib.listNotes(ctx.guild.id, doc.ticket_id, { limit: 25 });
    const lines = notes.length
      ? notes.map((n) => `**<@${n.by}>** (${n.at ? new Date(n.at).toLocaleString('tr-TR') : '-'}) — ${n.note}`)
      : [t('ticket.no_notes')];
    await ctx.reply(listTemplate({ title: t('ticket.notes_title'), lines }));
  },
};
