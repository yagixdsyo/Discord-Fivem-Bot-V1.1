/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { createTranslator } from '../../../locales/index.js';

export default {
  name: 'ticket-cikar',
  aliases: ['ticket-uye-cikar'],
  description: 'Ticket kanalindan uye cikarir.',
  category: 'Ticket',
  system: 'ticket',
  cooldown: 3,
  permission: { discord: ['ManageChannels'] },
  args: [{ name: 'kullanici', type: 'user', required: true, description: 'Cikarilacak uye' }],

  async run(ctx) {
    const t = ctx.t;
    const arg = ctx.args.kullanici;
    const target = arg?.user ?? arg;
    const ticketLib = await import('../lib/tickets.js');
    const doc = await ticketLib.getTicketByChannel(ctx.channel.id).catch(() => null);
    if (!doc) {
      await ctx.reply(errorTemplate(t('ticket.not_found_title'), [t('ticket.not_found')]));
      return;
    }
    const channel = ctx.guild.channels.cache.get(doc.channel_id) ?? (await ctx.guild.channels.fetch(doc.channel_id).catch(() => null));
    if (channel?.permissionOverwrites) await channel.permissionOverwrites.delete(target.id).catch(() => {});
    await ticketLib.removeParticipant(ctx.guild.id, doc.ticket_id, target.id);
    await ctx.reply(success(t('ticket.member_removed_title'), [t('ticket.member_removed', { kullanici: `<@${target.id}>` })]));
  },
};
