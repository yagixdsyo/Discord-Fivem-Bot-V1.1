/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { resolveTargetGuild } from '../lib/guildResolve.js';
import { auditAction } from '../lib/audit.js';
import { ownerConfirm } from '../lib/confirm.js';
import { success } from '../../ui/templates/index.js';

export default {
  name: 'sunucu-ayrıl',
  aliases: ['sunucu-ayril'],
  description: 'Botun bir sunucudan ayrılmasını sağlar.',
  category: 'Sunucu',
  args: [{ name: 'sunucu', type: 'string', required: false, description: 'Sunucu ID veya adı' }],

  async run(ctx) {
    const t = ctx.t;
    const guild = await resolveTargetGuild(ctx, ctx.args.sunucu, { required: false });
    if (!guild) return;

    const approved = await ownerConfirm(ctx, {
      title: t('owner.confirm_leave_title'),
      description: [t('owner.confirm_leave_body', { sunucu: guild.name })],
      danger: true,
    });
    if (!approved) return;

    await guild.leave().catch(() => {});

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'sunucu-ayril',
      target: guild.id,
      guildId: guild.id,
      t,
    });

    await ctx.reply(success(t('owner.left_guild', { sunucu: guild.name }), []));
  },
};
