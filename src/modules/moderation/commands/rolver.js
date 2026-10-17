/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { success as successTemplate } from '../../../ui/templates/index.js';
import { logPunishment, reasonText } from '../lib/punishFlow.js';
import { grantRole, roleErrorCard } from '../lib/roles.js';

export default {
  name: 'rolver',
  aliases: ['rol-ver'],
  description: 'Bir üyeye rol verir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  permission: { discord: ['ManageRoles'], node: 'moderation.rol' },
  args: [
    { name: 'kullanici', type: 'member', required: true, description: 'Rol verilecek üye' },
    { name: 'rol', type: 'role', required: true, description: 'Verilecek rol' },
    { name: 'sebep', type: 'rest', required: false, description: 'Sebep' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const targetMember = ctx.args.kullanici;
    const targetUser = targetMember.user;
    const role = ctx.args.rol;
    const reason = reasonText(ctx);

    if (targetMember.roles.cache.has(role.id)) {
      await ctx.reply(successTemplate(t('moderation.role.already_title'), [t('moderation.role.already_body')]));
      return;
    }

    const granted = await grantRole({
      guild: ctx.guild,
      actorMember: ctx.member,
      botMember: ctx.guild.members.me,
      targetMember,
      role,
      reason: reason ?? 'Moderasyon: rol verildi',
      via: 'komut',
      actorId: ctx.user.id,
      actorTag: ctx.user.username ?? null,
    });
    if (!granted.ok) {
      await ctx.reply(roleErrorCard(t, granted.reason));
      return;
    }

    await logPunishment(ctx, {
      key: 'log_rol_ver_al',
      targetUserId: targetUser.id,
      targetTag: targetUser.username,
      reason,
      lines: [`Rol: <@&${role.id}>`, 'İşlem: **rol verildi**', reason ? `Sebep: ${reason}` : null].filter(Boolean),
      accent: 'warn',
    });

    await ctx.reply(
      successTemplate(t('moderation.role.given_title'), [
        t('moderation.result.target', { kullanici: `<@${targetUser.id}>`, etiket: targetUser.username }),
        t('moderation.role.role_line', { rol: `<@&${role.id}>` }),
        reason ? t('moderation.result.reason', { sebep: reason }) : null,
      ].filter(Boolean)),
    );
  },
};
