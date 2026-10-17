/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success } from '../../../ui/templates/index.js';
import { getChannelId } from '../lib/maps.js';
import { createNameRequest } from '../lib/whitelist.js';
import { nameRequestPayload } from '../lib/view.js';

function requestId(kind) {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default {
  name: 'ic-isim',
  aliases: ['icisim'],
  description: 'IC isim değişikliği talebi oluşturur; onaya düşer.',
  category: 'FiveM',
  system: 'whitelist',
  cooldown: 5,
  permission: { discord: ['ManageNicknames'] },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Kullanıcı' },
    { name: 'isim', type: 'string', required: true, description: 'Yeni IC isim' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const arg = ctx.args.kullanici;
    const user = arg?.user ?? arg;
    const isim = String(ctx.args.isim ?? '').trim();
    if (!isim) {
      await ctx.reply(errorTemplate(t('fivem.name.name_required_title'), [t('fivem.name.name_required')]));
      return;
    }

    const channelId = await getChannelId(ctx.guild.id, 'ic_isim_onay');
    if (!channelId) {
      await ctx.reply(errorTemplate(t('fivem.name.channel_missing_title'), [t('fivem.name.channel_missing')]));
      return;
    }
    const channel = ctx.guild.channels.cache.get(channelId) ?? (await ctx.guild.channels.fetch(channelId).catch(() => null));
    if (!channel || typeof channel.send !== 'function') {
      await ctx.reply(errorTemplate(t('fivem.name.channel_missing_title'), [t('fivem.name.channel_missing')]));
      return;
    }

    const doc = await createNameRequest({
      guildId: ctx.guild.id,
      userId: user.id,
      userTag: user.username ?? null,
      kind: 'ic',
      name: isim.slice(0, 32),
      requestId: requestId('ic'),
    });

    const ownerId = ctx.user.id;
    await channel.send(nameRequestPayload(t, { doc, ownerId })).catch(() => {});

    await ctx.reply(
      success(t('fivem.name.request_title'), [
        t('fivem.name.request_line', { kullanici: `<@${user.id}>`, isim: `**${doc.name}**` }),
        t('fivem.name.request_channel', { kanal: `<#${channel.id}>` }),
      ]),
    );
  },
};
