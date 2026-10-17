/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { applyWhitelist } from '../lib/whitelist.js';
import { whitelistPayload } from '../lib/view.js';

export default {
  name: 'whal',
  aliases: [],
  description: 'Hızlı whitelist onayı: rolü verir (isim değiştirmez).',
  category: 'FiveM',
  system: 'whitelist',
  cooldown: 3,
  permission: { discord: ['ManageRoles'] },
  args: [{ name: 'kullanici', type: 'user', required: true, description: 'Kullanıcı' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const arg = ctx.args.kullanici;
    const member = arg?.roles ? arg : await ctx.guild.members.fetch(arg?.user?.id ?? arg?.id ?? '').catch(() => null);
    if (!member) {
      await ctx.reply(errorTemplate(t('fivem.wh.member_missing_title'), [t('fivem.wh.member_missing')]));
      return;
    }

    const result = await applyWhitelist(ctx.guild, { member, actorId: ctx.user.id });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.wh.fail_title'), [t('fivem.wh.fail')]));
      return;
    }

    await emitLog(ctx.guild, 'log_whitelist', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: member.id,
      targetTag: member.user.username,
      lines: [t('fivem.wh.log_given', { kullanici: `<@${member.id}>`, isim: t('common.none') })],
      accent: 'success',
    });

    await ctx.reply(whitelistPayload(t, { action: 'ver', userId: member.id, actorId: ctx.user.id }));
  },
};
