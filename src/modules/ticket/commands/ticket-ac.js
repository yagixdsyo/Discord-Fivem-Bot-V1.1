/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { success } from '../../../ui/templates/index.js';
import { createTranslator } from '../../../locales/index.js';

export default {
  name: 'ticket-ac',
  aliases: ['ticket-aç', 'ticket-open'],
  description: 'Seçilen kullanıcı adına ticket açar.',
  category: 'Ticket',
  system: 'ticket',
  cooldown: 5,
  permission: { discord: ['ManageChannels'] },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Ticket açılacak kullanıcı' },
    { name: 'kategori', type: 'string', required: false, description: 'Kategori (destek|bug|...) ' },
    { name: 'sebep', type: 'rest', required: false, description: 'Sebep' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const arg = ctx.args.kullanici;
    const target = arg?.user ?? arg;
    const member = await ctx.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      await ctx.reply(errorTemplate(t('ticket.member_missing_title'), [t('ticket.member_missing')]));
      return;
    }
    const category = ctx.args.kategori ?? 'destek';
    const subject = ctx.args.sebep ?? null;

    await ctx.deferReply({ ephemeral: true });
    const { openTicket } = await import('../lib/open.js');
    const result = await openTicket(ctx.guild, member, { category, subject });
    if (!result.ok) {
      if (result.existing) {
        const ch = ctx.guild.channels.cache.get(result.existing.channel_id);
        await ctx.editReply(errorTemplate(t('ticket.already_open_title'), [t('ticket.already_open', { kanal: ch ? `<#${ch.id}>` : result.existing.ticket_id })]));
      } else {
        await ctx.editReply(errorTemplate(t('ticket.open_fail_title'), [t('ticket.open_fail')]));
      }
      return;
    }
    await ctx.editReply(success(t('ticket.opened_title'), [t('ticket.opened_link', { kanal: `<#${result.channel.id}>` })]));
  },
};
