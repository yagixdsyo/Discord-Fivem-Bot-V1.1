/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { applyStatusChange } from '../lib/statusFlow.js';
import { statusChangePayload } from '../lib/view.js';

export default {
  name: 'aktif',
  aliases: ['sunucu-aktif'],
  description: 'Sunucu durumunu Aktif yapar, paneli ve duyuruyu günceller.',
  category: 'FiveM',
  system: 'fivem_durum',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'ping', type: 'boolean', required: false, description: 'Oyuncu rolünü pingler' },
    { name: 'not', type: 'rest', required: false, description: 'Duyuru notu' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const result = await applyStatusChange(ctx, { state: 'aktif', note: ctx.args.not ?? null, ping: ctx.args.ping === true });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.status.save_fail_title'), [t('fivem.status.save_fail')]));
      return;
    }

    await ctx.reply(
      statusChangePayload(t, {
        state: 'aktif',
        note: ctx.args.not ?? null,
        lines: [result.panel?.updated || result.panel?.posted ? t('fivem.status.panel_ok') : t('fivem.status.panel_missing')],
      }),
    );
  },
};
