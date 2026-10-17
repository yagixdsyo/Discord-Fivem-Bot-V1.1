/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { applyStatusChange } from '../lib/statusFlow.js';
import { statusChangePayload } from '../lib/view.js';

export default {
  name: 'bakım',
  aliases: ['bakim'],
  description: 'Sunucuyu bakıma alır; süre dolunca panel otomatik Aktif olur.',
  category: 'FiveM',
  system: 'fivem_durum',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    { name: 'sure', type: 'duration', required: true, description: 'Bakım süresi (örn. 30dk, 2sa)' },
    { name: 'ping', type: 'boolean', required: false, description: 'Oyuncu rolünü pingler' },
    { name: 'not', type: 'rest', required: false, description: 'Bakım notu' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const durationMs = ctx.args.sure?.ms ?? null;
    if (!durationMs) {
      await ctx.reply(errorTemplate(t('moderation.errors.duration_required.title'), [t('moderation.errors.duration_required.body')]));
      return;
    }

    const until = new Date(Date.now() + durationMs).toISOString();
    const result = await applyStatusChange(ctx, { state: 'bakim', until, note: ctx.args.not ?? null, ping: ctx.args.ping === true });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.status.save_fail_title'), [t('fivem.status.save_fail')]));
      return;
    }

    await ctx.reply(
      statusChangePayload(t, {
        state: 'bakim',
        until,
        note: ctx.args.not ?? null,
      }),
    );
  },
};
