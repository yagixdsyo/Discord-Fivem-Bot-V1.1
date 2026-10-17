/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { AttachmentBuilder } from 'discord.js';
import { serverInfoPayload } from '../lib/view.js';
import { gallery } from '../../../ui/v2.js';
import { renderProfilePng } from '../../../ui/canvas/cards.js';
import { getColor } from '../../../ui/colors.js';

export default {
  name: 'sunucu-bilgi',
  aliases: ['sunucubilgi', 'serverinfo'],
  description: 'Sunucu bilgi kartını gösterir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  args: [],

  async run(ctx) {
    const t = ctx.t;
    const guild = ctx.guild;

    const counts = {
      members: guild.memberCount ?? guild.members.cache.size,
      channels: guild.channels.cache.size,
      roles: guild.roles.cache.size,
      boosts: guild.premiumSubscriptionCount ?? 0,
      boostTier: guild.premiumTier ?? 0,
    };
    const payloadObj = serverInfoPayload(t, { guild, counts });

    // Canvas sunucu karti (galeri olarak eklenir; hata halinde metin karti kalir)
    const fileName = `sunucu-${guild.id}.png`;
    const png = await renderProfilePng({
      title: guild.name,
      subtitle: t('moderation.server.canvas_subtitle'),
      avatarUrl: guild.iconURL?.({ extension: 'png', size: 256 }) ?? null,
      stats: [
        { label: t('moderation.server.members'), value: String(counts.members) },
        { label: t('moderation.server.channels'), value: String(counts.channels) },
        { label: t('moderation.server.roles'), value: String(counts.roles) },
        { label: t('moderation.server.boosts'), value: `${counts.boosts} (${t('moderation.say.tier')}: ${counts.boostTier})` },
      ],
      accent: getColor('primary'),
    });
    if (png && payloadObj?.components?.[0]?.addMediaGalleryComponents) {
      payloadObj.components[0].addMediaGalleryComponents(gallery([`attachment://${fileName}`]));
      payloadObj.files = [new AttachmentBuilder(png, { name: fileName })];
    }

    await ctx.reply(payloadObj);
  },
};
