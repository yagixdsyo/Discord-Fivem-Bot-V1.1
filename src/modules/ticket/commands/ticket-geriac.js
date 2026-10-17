/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';

export default {
  name: 'ticket-geriac',
  aliases: ['ticket-reopen'],
  description: 'Kapali ticketi yeniden acar.',
  category: 'Ticket',
  system: 'ticket',
  cooldown: 5,
  permission: { discord: ['ManageChannels'] },
  args: [{ name: 'ticket', type: 'string', required: true, description: 'Ticket ID' }],
  async run(ctx) {
    const t = ctx.t;
    const lib = await import('../lib/tickets.js');
    const doc = await lib.getTicket(ctx.guild.id, ctx.args.ticket);
    if (!doc) {
      await ctx.reply(errorTemplate(t('ticket.not_found_title'), [t('ticket.not_found')]));
      return;
    }
    const channel = ctx.guild.channels.cache.get(doc.channel_id) ?? (await ctx.guild.channels.fetch(doc.channel_id).catch(() => null));
    const result = await lib.reopenTicket(ctx.guild.id, doc.ticket_id, { by: ctx.user.id });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('ticket.close_fail_title'), [t('ticket.close_fail')]));
      return;
    }
    if (channel?.permissionOverwrites) await channel.permissionOverwrites.edit(doc.user_id, { ViewChannel: true, SendMessages: true }).catch(() => {});
    await ctx.reply(success(t('ticket.reopened_title'), [t('ticket.reopened')]));
  },
};
