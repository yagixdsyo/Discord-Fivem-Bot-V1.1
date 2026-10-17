/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';

export default {
  name: 'ticket-kur',
  aliases: ['ticket-kurulum', 'ticket-panel'],
  description: 'Ticket panelini belirtilen kanala kurar.',
  category: 'Ticket',
  system: 'ticket',
  cooldown: 10,
  permission: { discord: ['ManageGuild'] },
  args: [{ name: 'kanal', type: 'channel', required: true, description: 'Panel gonderilecek metin kanali' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }
    const channel = ctx.args.kanal;
    if (typeof channel?.isTextBased !== 'function' || !channel.isTextBased()) {
      await ctx.reply(errorTemplate(t('ticket.channel_invalid_title'), [t('ticket.channel_invalid')]));
      return;
    }

    const { buildTicketPanel, applyTicketPanelState } = await import('../lib/panel.js');
    const panel = buildTicketPanel(t);

    let message = null;
    const cfg = await (await import('../lib/config.js')).getTicketConfig(ctx.guild.id);
    if (cfg.panelChannelId && cfg.panelMessageId) {
      const oldCh = ctx.guild.channels.cache.get(cfg.panelChannelId) ?? (await ctx.guild.channels.fetch(cfg.panelChannelId).catch(() => null));
      if (oldCh) {
        message = await oldCh.messages.fetch(cfg.panelMessageId).catch(() => null);
        if (message) message = await message.edit(panel).catch(() => null);
      }
    }
    if (!message) message = await channel.send(panel);

    await applyTicketPanelState(ctx.guild.id, { channelId: channel.id, messageId: message.id });

    await ctx.reply(card({
      emojiKey: 'BASARI',
      title: t('ticket.panel_done_title'),
      lines: [t('ticket.panel_done', { kanal: `<#${channel.id}>` })],
      accent: 'success',
    }));
  },
};
