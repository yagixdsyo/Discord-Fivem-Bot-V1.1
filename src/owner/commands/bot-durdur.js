/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { parsePauseInput } from '../lib/parse.js';
import { setGlobalPause } from '../lib/state.js';
import { auditAction } from '../lib/audit.js';
import { success, warn } from '../../ui/templates/index.js';

export default {
  name: 'bot-durdur',
  description: 'Bütün sunucularda komutları duraklatır (owner hariç).',
  category: 'Bot',
  args: [
    { name: 'girdi', type: 'rest', required: false, description: '[süre] [sebep] [--guard]' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const { guard, duration, reason } = parsePauseInput(ctx.args.girdi);
    const until = duration ? Date.now() + duration.ms : null;

    const result = await setGlobalPause({ enabled: true, reason, until, setBy: ctx.user.id, guard });
    if (!result.ok) {
      await ctx.reply(warn(t('owner.db_unavailable'), []));
      return;
    }

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'bot-durdur',
      payload: { sure: duration?.display ?? null, sebep: reason, guard },
      t,
    });

    const lines = [
      until
        ? t('owner.pause.until', { bitis: `<t:${Math.floor(until / 1000)}:R>` })
        : t('owner.pause.indefinite'),
      guard ? t('owner.pause.guard_stopped') : t('owner.pause.guard_running'),
    ];
    if (reason) lines.push(t('owner.reason_line', { sebep: reason }));

    await ctx.reply(success(t('owner.pause.done'), lines));
  },
};
