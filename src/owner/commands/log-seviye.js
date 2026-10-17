/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { getLogger } from '../../core/logger.js';
import { auditAction } from '../lib/audit.js';
import { success, warn } from '../../ui/templates/index.js';

const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'];

export default {
  name: 'log-seviye',
  description: 'Çalışma anında log seviyesini değiştirir.',
  category: 'Sistem',
  args: [{ name: 'seviye', type: 'string', required: true, description: LEVELS.join(', ') }],

  async run(ctx) {
    const t = ctx.t;
    const level = String(ctx.args.seviye ?? '').toLowerCase();

    if (!LEVELS.includes(level)) {
      await ctx.reply(warn(t('owner.loglevel.invalid', { seviye: level, gecerli: LEVELS.join(', ') }), []));
      return;
    }

    getLogger().level = level;

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'log-seviye',
      target: level,
      t,
    });

    await ctx.reply(success(t('owner.loglevel.done', { seviye: level }), []));
  },
};
