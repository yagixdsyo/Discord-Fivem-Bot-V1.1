/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { ownerConfirm } from '../lib/confirm.js';
import { auditAction } from '../lib/audit.js';
import { requestLifecycle } from '../../core/lifecycle.js';
import { warn } from '../../ui/templates/index.js';

export default {
  name: 'bot-kapat',
  description: 'Botu tamamen kapatır (onay gerekir).',
  category: 'Bot',

  async run(ctx) {
    const t = ctx.t;

    const approved = await ownerConfirm(ctx, {
      title: t('owner.power.off_confirm_title'),
      description: [t('owner.power.off_confirm_body')],
      danger: true,
    });
    if (!approved) return;

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'bot-kapat',
      t,
    });

    await ctx.reply(warn(t('owner.power.off_notice'), [t('owner.power.off_notice_body')]));
    await requestLifecycle('stop', { by: ctx.user.id });
  },
};
