/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { confirm as confirmTemplate, error as errorTemplate, success } from '../../../ui/templates/index.js';
import { runConfirm } from '../../moderation/lib/uiFlow.js';
import { createTranslator } from '../../../locales/index.js';

export default {
  name: 'ticket-sil',
  aliases: ['ticket-delete'],
  description: 'Ticketi kapatir ve verisini siler (onayli).',
  category: 'Ticket',
  system: 'ticket',
  cooldown: 10,
  permission: { discord: ['Administrator'] },
  args: [{ name: 'id', type: 'string', required: false, description: 'Ticket ID' }],

  async run(ctx) {
    const t = ctx.t;
    const ticketLib = await import('../lib/tickets.js');
    const doc = ctx.args.id
      ? await ticketLib.getTicket(ctx.guild.id, ctx.args.id)
      : await ticketLib.getTicketByChannel(ctx.channel.id);
    if (!doc) {
      await ctx.reply(errorTemplate(t('ticket.not_found_title'), [t('ticket.not_found')]));
      return;
    }
    const ownerId = ctx.user.id;
    const payload = confirmTemplate({
      title: t('ticket.delete_confirm_title'),
      description: [t('ticket.delete_confirm_body', { id: doc.ticket_id })],
      confirmId: `ticketdelonay:${ownerId}`,
      cancelId: `ticketdeliptal:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });
    const confirmed = await runConfirm(ctx, { payload, ownerId, confirmId: `ticketdelonay:${ownerId}`, cancelId: `ticketdeliptal:${ownerId}` });
    if (!confirmed) return;

    const channel = doc.channel_id ? ctx.guild.channels.cache.get(doc.channel_id) : null;
    if (channel) await channel.delete().catch(() => {});
    await ticketLib.removeTicket(ctx.guild.id, doc.ticket_id);
    await ctx.followUp(success(t('ticket.deleted_title'), [t('ticket.deleted_line', { id: doc.ticket_id })]));
  },
};
