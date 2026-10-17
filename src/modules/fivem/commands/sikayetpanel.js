/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { getChannelId } from '../lib/maps.js';
import { getSetting, setSetting } from '../lib/state.js';
import { complaintPanelPayload } from '../lib/view.js';

export default {
  name: 'şikayet-panel',
  aliases: ['sikayet-panel', 'sikayetpanel'],
  description: 'Şikayet panelini kurar (Şikayet Et butonu + modal).',
  category: 'FiveM',
  system: null,
  cooldown: 10,
  permission: { discord: ['ManageGuild'] },
  args: [{ name: 'kanal', type: 'channel', required: false, description: 'Panel kanalı (varsayılan: şikayet-panel)' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const channelId = ctx.args.kanal?.id ?? (await getChannelId(ctx.guild.id, 'panel_sikayet'));
    if (!channelId) {
      await ctx.reply(errorTemplate(t('fivem.sikayet.channel_missing_title'), [t('fivem.sikayet.channel_missing')]));
      return;
    }
    const channel = ctx.guild.channels.cache.get(channelId) ?? (await ctx.guild.channels.fetch(channelId).catch(() => null));
    if (!channel || typeof channel.send !== 'function') {
      await ctx.reply(errorTemplate(t('fivem.sikayet.channel_missing_title'), [t('fivem.sikayet.channel_missing')]));
      return;
    }

    const payload = complaintPanelPayload(t);
    let message = null;

    const existing = await getSetting(ctx.guild.id, 'fivem.sikayet.panel');
    if (existing?.channelId && existing?.messageId) {
      const oldChannel =
        ctx.guild.channels.cache.get(existing.channelId) ?? (await ctx.guild.channels.fetch(existing.channelId).catch(() => null));
      if (oldChannel && typeof oldChannel.messages?.fetch === 'function') {
        const oldMessage = await oldChannel.messages.fetch(existing.messageId).catch(() => null);
        if (oldMessage) message = await oldMessage.edit(payload).catch(() => null);
      }
    }
    if (!message) message = await channel.send(payload);

    await setSetting(ctx.guild.id, 'fivem.sikayet.panel', { channelId: channel.id, messageId: message.id });

    await ctx.reply(success(t('fivem.sikayet.panel_done_title'), [t('fivem.sikayet.panel_done', { kanal: `<#${channel.id}>` })]));
  },
};
