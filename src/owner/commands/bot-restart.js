/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ownerConfirm } from '../lib/confirm.js';
import { auditAction } from '../lib/audit.js';
import { requestLifecycle } from '../../core/lifecycle.js';
import { info } from '../../ui/templates/index.js';

export default {
  name: 'bot-restart',
  description: 'Botu temiz şekilde yeniden başlatır (onay gerekir).',
  category: 'Bot',

  async run(ctx) {
    const t = ctx.t;

    const approved = await ownerConfirm(ctx, {
      title: t('owner.power.restart_confirm_title'),
      description: [t('owner.power.restart_confirm_body')],
      danger: true,
    });
    if (!approved) return;

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'bot-restart',
      t,
    });

    await ctx.reply(info(t('owner.power.restart_notice'), [t('owner.power.restart_notice_body')]));
    await requestLifecycle('restart', { by: ctx.user.id });
  },
};
