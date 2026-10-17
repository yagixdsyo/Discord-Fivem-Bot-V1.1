/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { emitLog } from '../../logging/lib/emit.js';
import { createOlusum, getOlusum } from '../lib/olusum.js';
import { olusumInfoPayload } from '../lib/view.js';

export default {
  name: 'oluşum-aç',
  aliases: ['olusum-ac'],
  description: 'Yeni bir oluşum (grup) kaydı açar.',
  category: 'FiveM',
  system: null,
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'ad', type: 'string', required: true, description: 'Oluşum adı' },
    { name: 'rol', type: 'role', required: true, description: 'Oluşum rolü' },
    { name: 'patron', type: 'user', required: false, description: 'Patron (sahip)' },
    { name: 'sinir', type: 'integer', required: false, description: 'Üye sınırı (0 = sınırsız)' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const name = String(ctx.args.ad ?? '').trim();
    const role = ctx.args.rol;
    if (!name || !role) {
      await ctx.reply(errorTemplate(t('fivem.olusum.input_missing_title'), [t('fivem.olusum.input_missing')]));
      return;
    }

    const roleTaken = await getOlusum(ctx.guild.id, { roleId: role.id });
    if (roleTaken?.active) {
      await ctx.reply(errorTemplate(t('fivem.olusum.role_taken_title'), [t('fivem.olusum.role_taken', { rol: `<@&${role.id}>` })]));
      return;
    }

    const patronArg = ctx.args.patron;
    const patron = patronArg?.user ?? patronArg;
    const result = await createOlusum({
      guildId: ctx.guild.id,
      name,
      roleId: role.id,
      ownerId: patron?.id ?? null,
      ownerTag: patron?.username ?? null,
      limit: Math.max(0, ctx.args.sinir ?? 0),
    });

    if (!result.ok) {
      await ctx.reply(errorTemplate(t('fivem.olusum.create_fail_title'), [t('fivem.olusum.create_fail')]));
      return;
    }

    await emitLog(ctx.guild, 'log_olusum_bilgi', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [
        t('fivem.olusum.log_created', { ad: `**${name}**`, rol: `<@&${role.id}>` }),
        patron ? t('fivem.olusum.log_owner', { patron: `<@${patron.id}>` }) : null,
      ].filter(Boolean),
      accent: 'success',
    });

    await ctx.reply(olusumInfoPayload(t, { doc: result.doc, roleName: role.name }));
  },
};
