/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { setGlobalPause } from '../lib/state.js';
import { auditAction } from '../lib/audit.js';
import { success, warn } from '../../ui/templates/index.js';

export default {
  name: 'bot-devam',
  description: 'Global duraklatmayı kaldırır.',
  category: 'Bot',

  async run(ctx) {
    const t = ctx.t;
    const result = await setGlobalPause({ enabled: false, setBy: ctx.user.id });
    if (!result.ok) {
      await ctx.reply(warn(t('owner.db_unavailable'), []));
      return;
    }

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'bot-devam',
      t,
    });

    await ctx.reply(success(t('owner.pause.resumed'), []));
  },
};
