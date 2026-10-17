/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, warn as warnTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { applyWhitelist } from '../lib/whitelist.js';
import { whitelistPayload } from '../lib/view.js';

export default {
  name: 'whitelist-ver',
  aliases: ['wver'],
  description: 'Bir kullanıcıya whitelist rolü verir (isteğe bağlı isim sablonu).',
  category: 'FiveM',
  system: 'whitelist',
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Whitelist verilecek kullanıcı' },
    { name: 'isim', type: 'string', required: false, description: 'IC isim (şablona yazılır)' },
    { name: 'dm', type: 'boolean', required: false, description: 'Kullanıcıya DM gönderilsin mi' },
  ],

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

    const isim = ctx.args.isim ? String(ctx.args.isim).trim() : null;
    const result = await applyWhitelist(ctx.guild, { member, actorId: ctx.user.id, isim });
    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.wh.fail_title'), [t(`fivem.wh.error.${result.error}`) === `fivem.wh.error.${result.error}` ? t('fivem.wh.fail') : t(`fivem.wh.error.${result.error}`)]));
      return;
    }

    await emitLog(ctx.guild, 'log_whitelist', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      target: member.id,
      targetTag: member.user.username,
      lines: [t('fivem.wh.log_given', { kullanici: `<@${member.id}>`, isim: isim ? `**${isim}**` : t('common.none') })],
      accent: 'success',
    });

    if (ctx.args.dm === true) {
      const payload = whitelistPayload(t, { action: 'ver', userId: member.id, isim, actorId: ctx.user.id });
      await member.send(payload).catch(() => {});
    }

    await ctx.reply(whitelistPayload(t, { action: 'ver', userId: member.id, isim, actorId: ctx.user.id }));
  },
};
