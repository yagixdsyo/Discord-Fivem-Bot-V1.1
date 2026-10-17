/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { getRoomsConfig, roomCreatePanelPayload, setRoomsConfig } from '../lib/rooms.js';

export default {
  name: 'oda-kur',
  aliases: [],
  description: 'Özel oda panelini kurar; buton ve/veya join-to-create ses kanalını ayarlar.',
  category: 'Özel Oda',
  system: 'ozel_oda',
  cooldown: 10,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'kanal', type: 'channel', required: true, description: 'Panelin gönderileceği metin kanalı' },
    { name: 'seskanal', type: 'voiceChannel', required: false, description: 'Odaya girince otomatik oda açılan ses kanalı' },
    { name: 'kategori', type: 'channel', required: false, description: 'Yeni odaların açılacağı kategori' },
    {
      name: 'sahipsil',
      type: 'choice',
      required: false,
      choices: ['ac', 'kapat'],
      description: 'Oda sahibi çıkınca oda silinsin mi (varsayılan: açık)',
    },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const channel = ctx.args.kanal;
    if (typeof channel?.isTextBased !== 'function' || !channel.isTextBased()) {
      await ctx.reply(errorTemplate(t('fivem.rooms.channel_invalid_title'), [t('fivem.rooms.channel_invalid')]));
      return;
    }

    const hub = ctx.args.seskanal ?? null;
    const category = ctx.args.kategori ?? null;
    const sahipsil = String(ctx.args.sahipsil ?? '').trim().toLocaleLowerCase('tr');

    const payload = roomCreatePanelPayload(t);

    const config = await getRoomsConfig(ctx.guild.id);
    let message = null;
    if (config.panelChannelId && config.panelMessageId) {
      const oldChannel =
        ctx.guild.channels.cache.get(config.panelChannelId) ?? (await ctx.guild.channels.fetch(config.panelChannelId).catch(() => null));
      if (oldChannel && typeof oldChannel.messages?.fetch === 'function') {
        const oldMessage = await oldChannel.messages.fetch(config.panelMessageId).catch(() => null);
        if (oldMessage) message = await oldMessage.edit(payload).catch(() => null);
      }
    }
    if (!message) message = await channel.send(payload);

    await setRoomsConfig(ctx.guild.id, {
      panelChannelId: channel.id,
      panelMessageId: message.id,
      hubChannelId: hub?.id ?? config.hubChannelId ?? null,
      categoryId: category?.id ?? config.categoryId ?? null,
      ...(sahipsil === 'ac' || sahipsil === 'kapat' ? { ownerLeaveDelete: sahipsil === 'ac' } : {}),
    });

    await ctx.followUp(
      card({
        emojiKey: 'BASARI',
        title: t('fivem.rooms.setup_done_title'),
        lines: [
          t('fivem.rooms.setup_done_panel', { kanal: `<#${channel.id}>` }),
          hub ? t('fivem.rooms.setup_done_hub', { kanal: `<#${hub.id}>` }) : t('fivem.rooms.setup_done_nohub'),
          category ? t('fivem.rooms.setup_done_category', { kategori: `**${category.name}**` }) : null,
          t('fivem.rooms.setup_done_owner', {
            durum: sahipsil === 'kapat' ? t('fivem.rooms.setup_owner_off') : t('fivem.rooms.setup_owner_on'),
          }),
        ].filter(Boolean),
        accent: 'success',
      }),
    );
  },
};
