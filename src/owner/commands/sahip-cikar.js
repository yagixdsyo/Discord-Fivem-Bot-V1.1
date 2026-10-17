/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { isPrimaryOwner, listExtraOwners, removeExtraOwner } from '../../core/ownerRegistry.js';
import { auditAction } from '../lib/audit.js';
import { info, success, warn } from '../../ui/templates/index.js';

export default {
  name: 'sahip-çıkar',
  aliases: ['sahip-cikar'],
  description: 'Geçici ek sahibi çıkarır (yalnızca ana sahip).',
  category: 'Genel',
  args: [{ name: 'kullanici', type: 'user', required: true, description: 'Kullanıcı' }],

  async run(ctx) {
    const t = ctx.t;

    if (!isPrimaryOwner(ctx.config, ctx.user.id)) {
      await ctx.reply(warn(t('owner.only_primary'), []));
      return;
    }

    const userId = ctx.args.kullanici?.id ?? String(ctx.args.kullanici ?? '').trim();
    if (ctx.config.ownerIds.includes(userId)) {
      await ctx.reply(warn(t('owner.owners.cannot_remove_main', { kullanici: `<@${userId}>` }), []));
      return;
    }

    const result = await removeExtraOwner(userId);
    if (!result.ok) {
      await ctx.reply(warn(t('owner.db_unavailable'), []));
      return;
    }
    if (!result.removed) {
      await ctx.reply(info(t('owner.owners.not_extra', { kullanici: `<@${userId}>` }), []));
      return;
    }

    await auditAction({
      config: ctx.config,
      ownerId: ctx.user.id,
      action: 'sahip-cikar',
      target: userId,
      t,
    });

    const extras = await listExtraOwners();
    await ctx.reply(
      success(t('owner.owners.removed', { kullanici: `<@${userId}>` }), [
        t('owner.owners.extra_list', { adet: extras.length }),
      ]),
    );
  },
};
