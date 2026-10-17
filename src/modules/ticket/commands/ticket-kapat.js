/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';

export default {
  name: 'ticket-kapat',
  aliases: ['ticket-kapa'],
  description: 'Ticketi kapatir: transcript ticket loguna gider, kanal silinir.',
  category: 'Ticket',
  system: 'ticket',
  cooldown: 5,
  permission: { discord: [] },
  args: [{ name: 'id', type: 'string', required: false, description: 'Ticket ID (opsiyonel: mevcut kanal)' }],

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

    const cfgLib = await import('../lib/config.js');
    const cfg = await cfgLib.getTicketConfig(ctx.guild.id);
    const isStaff = (cfg.staffRoles ?? []).some((r) => ctx.member?.roles?.cache?.has?.(r));
    if (!isStaff && doc.user_id !== ctx.user.id) {
      await ctx.reply(errorTemplate(t('ticket.perm_title'), [t('ticket.perm_body')]));
      return;
    }
    if (!isStaff && !cfg.allowMemberClose) {
      await ctx.reply(errorTemplate(t('ticket.no_member_close_title'), [t('ticket.no_member_close')]));
      return;
    }

    await ctx.deferReply({ ephemeral: true });

    const { finalizeTicketClose } = await import('../lib/closeFlow.js');
    const result = await finalizeTicketClose({
      guild: ctx.guild,
      client: ctx.client,
      doc,
      by: ctx.user.id,
      reason: isStaff ? 'yetkili' : 'sahip',
      t,
    });

    if (!result.ok) {
      await ctx.followUp(errorTemplate(t('ticket.close_fail_title'), [t('ticket.close_fail')]));
      return;
    }

    const lines = [t('ticket.closed', { kanal: `#${result.channelName ?? doc.channel_id}` })];
    if (result.logChannelId) lines.push(t('ticket.closed_log_line', { kanal: `<#${result.logChannelId}>` }));
    lines.push(t('ticket.closed_delete'));
    await ctx.followUp(success(t('ticket.closed_title'), lines));
  },
};
