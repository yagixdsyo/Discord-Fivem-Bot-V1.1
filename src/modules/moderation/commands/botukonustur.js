/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success as successTemplate } from '../../../ui/templates/index.js';
import { container, payload, text } from '../../../ui/v2.js';

export default {
  name: 'botu-konuştur',
  aliases: ['botukonustur', 'konustur'],
  description: 'Botun belirtilen kanala mesaj yazmasını sağlar.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  permission: { discord: ['ManageMessages'], node: 'moderation.mesaj' },
  args: [
    { name: 'kanal', type: 'channel', required: true, description: 'Mesajın gönderileceği kanal' },
    { name: 'mesaj', type: 'rest', required: true, description: 'Gönderilecek mesaj' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const channel = ctx.args.kanal;
    const mesaj = String(ctx.args.mesaj ?? '').slice(0, 1900);

    if (!channel?.isTextBased?.()) {
      await ctx.reply(errorTemplate(t('moderation.write.not_text_title'), [t('moderation.write.not_text_body')]));
      return;
    }

    const sent = await channel
      .send(payload({ components: [container([text(mesaj)])] }))
      .catch(() => null);

    if (!sent) {
      await ctx.reply(errorTemplate(t('moderation.write.failed_title'), [t('moderation.write.failed_body')]));
      return;
    }

    await ctx.reply(
      successTemplate(t('moderation.talk.done_title'), [
        t('moderation.talk.done_body', { kanal: `<#${channel.id}>` }),
      ]),
    );
  },
};
