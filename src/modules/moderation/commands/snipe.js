/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { getSnipes } from '../lib/snipe.js';
import { snipePayload } from '../lib/view.js';

export default {
  name: 'snipe',
  aliases: ['snipe-son'],
  description: 'Kanalda silinen son mesajı gösterir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  permission: { discord: ['ManageMessages'], node: 'moderation.mesaj' },
  args: [{ name: 'adet', type: 'integer', required: false, description: 'Kaç kayıt (varsayılan 1, en fazla 5)' }],

  async run(ctx) {
    const t = ctx.t;
    const count = Math.min(Math.max(1, ctx.args.adet ?? 1), 5);
    const entries = await getSnipes(ctx.channel.id, { count, kind: 'silme' });

    if (entries.length === 0) {
      await ctx.reply(errorTemplate(t('moderation.snipe.empty_title'), [t('moderation.snipe.empty_body')]));
      return;
    }

    if (entries.length === 1) {
      await ctx.reply(snipePayload(t, { kind: 'silme', entry: entries[0] }));
      return;
    }

    const lines = entries.map((entry, index) =>
      t('moderation.snipe.list_line', {
        sira: index + 1,
        kullanici: `<@${entry.authorId}>`,
        tarih: `<t:${Math.floor((entry.at ?? Date.now()) / 1000)}:R>`,
        icerik: String(entry.content ?? '').replaceAll('```', '`\u200b``').slice(0, 300) || t('common.none'),
      }),
    );

    await ctx.reply(
      card({ emojiKey: 'ARAMA', title: t('moderation.snipe.title_silme'), lines, accent: 'info' }),
    );
  },
};
