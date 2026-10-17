/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { applyStatusChange } from '../lib/statusFlow.js';
import { statusChangePayload } from '../lib/view.js';

export default {
  name: 'kapalı',
  aliases: ['kapali'],
  description: 'Sunucu durumunu Kapalı yapar (otomatik geri dönüş yok).',
  category: 'FiveM',
  system: 'fivem_durum',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [{ name: 'not', type: 'rest', required: false, description: 'Not' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const result = await applyStatusChange(ctx, { state: 'kapali', note: ctx.args.not ?? null });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.status.save_fail_title'), [t('fivem.status.save_fail')]));
      return;
    }

    await ctx.reply(
      statusChangePayload(t, {
        state: 'kapali',
        note: ctx.args.not ?? null,
        lines: [t('fivem.status.manual_note')],
      }),
    );
  },
};
