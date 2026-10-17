/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { card } from '../../../ui/templates/base.js';
import { getSnipes } from '../lib/snipe.js';
import { snipePayload } from '../lib/view.js';

export default {
  name: 'editsnipe',
  aliases: ['snipe-edit'],
  description: 'Kanalda düzenlenen son mesajı gösterir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  permission: { discord: ['ManageMessages'], node: 'moderation.mesaj' },
  args: [{ name: 'adet', type: 'integer', required: false, description: 'Kaç kayıt (varsayılan 1, en fazla 5)' }],

  async run(ctx) {
    const t = ctx.t;
    const count = Math.min(Math.max(1, ctx.args.adet ?? 1), 5);
    const entries = await getSnipes(ctx.channel.id, { count, kind: 'duzenleme' });

    if (entries.length === 0) {
      await ctx.reply(errorTemplate(t('moderation.snipe.empty_edit_title'), [t('moderation.snipe.empty_edit_body')]));
      return;
    }

    if (entries.length === 1) {
      await ctx.reply(snipePayload(t, { kind: 'duzenleme', entry: entries[0] }));
      return;
    }

    const lines = entries.map((entry, index) =>
      t('moderation.snipe.list_edit_line', {
        sira: index + 1,
        kullanici: `<@${entry.authorId}>`,
        tarih: `<t:${Math.floor((entry.at ?? Date.now()) / 1000)}:R>`,
        eski: String(entry.oldContent ?? '').replaceAll('```', '`\u200b``').slice(0, 150) || t('common.none'),
        yeni: String(entry.content ?? '').replaceAll('```', '`\u200b``').slice(0, 150) || t('common.none'),
      }),
    );

    await ctx.reply(
      card({ emojiKey: 'DUZENLE', title: t('moderation.snipe.title_duzenleme'), lines, accent: 'info' }),
    );
  },
};
