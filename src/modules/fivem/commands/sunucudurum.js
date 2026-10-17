/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { applyStatusChange } from '../lib/statusFlow.js';
import { statusChangePayload } from '../lib/view.js';

const VALID = ['aktif', 'bakim', 'restart', 'kapali'];

export default {
  name: 'sunucu-durum',
  aliases: ['sunucudurum'],
  description: 'Sunucu durumunu seçilen değere ayarlar.',
  category: 'FiveM',
  system: 'fivem_durum',
  cooldown: 5,
  permission: { discord: ['ManageGuild'] },
  args: [
    {
      name: 'durum',
      type: 'choice',
      required: true,
      description: 'Yeni durum',
      choices: [
        { name: 'Aktif', value: 'aktif' },
        { name: 'Bakım', value: 'bakim' },
        { name: 'Restart', value: 'restart' },
        { name: 'Kapalı', value: 'kapali' },
      ],
    },
    { name: 'sure', type: 'duration', required: false, description: 'Bakım/Restart süresi' },
    { name: 'not', type: 'rest', required: false, description: 'Not' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const state = ctx.args.durum;
    if (!VALID.includes(state)) {
      await ctx.reply(errorTemplate(t('fivem.status.invalid_title'), [t('fivem.status.invalid')]));
      return;
    }

    const durationMs = ctx.args.sure?.ms ?? null;
    const until = durationMs && state !== 'aktif' && state !== 'kapali' ? new Date(Date.now() + durationMs).toISOString() : null;

    const result = await applyStatusChange(ctx, { state, until, note: ctx.args.not ?? null });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.status.save_fail_title'), [t('fivem.status.save_fail')]));
      return;
    }

    const lines = [];
    if (!until && state !== 'aktif' && state !== 'kapali') lines.push(t('fivem.status.manual_note'));
    await ctx.reply(statusChangePayload(t, { state, until, note: ctx.args.not ?? null, lines }));
  },
};
