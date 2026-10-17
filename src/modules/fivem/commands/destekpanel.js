/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { getSetting, setSetting } from '../lib/state.js';
import { supportPanelPayload } from '../lib/view.js';

export default {
  name: 'destek-panel',
  aliases: ['destekpanel'],
  description: 'Destek çağrı panelini ("Yetkili Çağır" butonu) kurar.',
  category: 'FiveM',
  system: 'destek_bekleme',
  cooldown: 10,
  permission: { discord: ['ManageGuild'] },
  args: [{ name: 'kanal', type: 'channel', required: false, description: 'Panel kanalı (boşsa bu kanal)' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const channel = ctx.args.kanal ?? ctx.channel;
    if (!channel || typeof channel.send !== 'function') {
      await ctx.reply(errorTemplate(t('fivem.destek.channel_missing_title'), [t('fivem.destek.channel_missing')]));
      return;
    }

    const payload = supportPanelPayload(t);
    let message = null;

    // Onceki paneli bul ve duzenle (tek panel kurali).
    const existing = await getSetting(ctx.guild.id, 'fivem.destek.panel');
    if (existing?.channelId && existing?.messageId) {
      const oldChannel =
        ctx.guild.channels.cache.get(existing.channelId) ?? (await ctx.guild.channels.fetch(existing.channelId).catch(() => null));
      if (oldChannel && typeof oldChannel.messages?.fetch === 'function') {
        const oldMessage = await oldChannel.messages.fetch(existing.messageId).catch(() => null);
        if (oldMessage) message = await oldMessage.edit(payload).catch(() => null);
      }
    }
    if (!message) message = await channel.send(payload);

    await setSetting(ctx.guild.id, 'fivem.destek.panel', { channelId: channel.id, messageId: message.id });

    await ctx.reply(success(t('fivem.destek.panel_done_title'), [t('fivem.destek.panel_done', { kanal: `<#${channel.id}>` })]));
  },
};
