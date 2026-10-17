/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { card } from '../../../ui/templates/base.js';
import { error as errorTemplate, success as successTemplate } from '../../../ui/templates/index.js';
import { gallery } from '../../../ui/v2.js';

export default {
  name: 'resim-at',
  aliases: ['resimat'],
  description: 'Belirtilen kanala görsel gönderir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  permission: { discord: ['ManageMessages'], node: 'moderation.mesaj' },
  args: [
    { name: 'kanal', type: 'channel', required: true, description: 'Gönderilecek kanal' },
    { name: 'resim', type: 'attachment', required: true, description: 'Görsel (ek veya url)' },
    { name: 'aciklama', type: 'rest', required: false, description: 'Açıklama' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const channel = ctx.args.kanal;
    const resim = ctx.args.resim;
    const aciklama = String(ctx.args.aciklama ?? '').trim();

    if (!channel?.isTextBased?.() || !resim?.url) {
      await ctx.reply(errorTemplate(t('moderation.image.failed_title'), [t('moderation.image.failed_body')]));
      return;
    }

    const sent = await channel
      .send(
        card({
          emojiKey: 'DOSYA',
          title: t('moderation.image.title'),
          lines: aciklama ? [aciklama] : [],
          fileComponents: [gallery([resim.url])],
          accent: 'primary',
        }),
      )
      .catch(() => null);

    if (!sent) {
      await ctx.reply(errorTemplate(t('moderation.image.failed_title'), [t('moderation.image.failed_body')]));
      return;
    }

    await ctx.reply(
      successTemplate(t('moderation.image.done_title'), [t('moderation.image.done_body', { kanal: `<#${channel.id}>` })]),
    );
  },
};
