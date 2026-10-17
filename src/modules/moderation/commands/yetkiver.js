/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success as successTemplate } from '../../../ui/templates/index.js';
import { getProtectedRoles } from '../../guard/lib/config.js';
import { logPunishment, reasonText } from '../lib/punishFlow.js';
import { grantRole, roleErrorCard } from '../lib/roles.js';

export default {
  name: 'yetki-ver',
  aliases: ['yetkiver'],
  description: 'Guard korumalı bir yetkili rolünü verir.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 3,
  permission: { discord: ['ManageRoles'], node: 'moderation.rol' },
  args: [
    { name: 'kullanici', type: 'member', required: true, description: 'Yetki verilecek üye' },
    { name: 'rol', type: 'role', required: true, description: 'Guard korumalı rol' },
    { name: 'sebep', type: 'rest', required: false, description: 'Sebep' },
  ],

  async run(ctx) {
    const t = ctx.t;
    const targetMember = ctx.args.kullanici;
    const targetUser = targetMember.user;
    const role = ctx.args.rol;
    const reason = reasonText(ctx);

    const protectedRoles = await getProtectedRoles(ctx.guild.id).catch(() => []);
    if (!protectedRoles.some((entry) => entry.role_id === role.id)) {
      await ctx.reply(
        errorTemplate(t('moderation.yetki.not_protected_title'), [t('moderation.yetki.not_protected_body')]),
      );
      return;
    }

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
      reason: reason ?? 'Yetki verildi',
      via: 'komut',
      actorId: ctx.user.id,
      actorTag: ctx.user.username ?? null,
    });
    if (!granted.ok) {
      await ctx.reply(roleErrorCard(t, granted.reason));
      return;
    }

    await logPunishment(ctx, {
      key: 'log_yetki_ver_al',
      targetUserId: targetUser.id,
      targetTag: targetUser.username,
      reason,
      lines: [
        `Rol: <@&${role.id}>`,
        'İşlem: **yetki verildi** (guard korumalı)',
        reason ? `Sebep: ${reason}` : null,
      ].filter(Boolean),
      accent: 'warn',
    });

    await ctx.reply(
      successTemplate(t('moderation.yetki.given_title'), [
        t('moderation.result.target', { kullanici: `<@${targetUser.id}>`, etiket: targetUser.username }),
        t('moderation.role.role_line', { rol: `<@&${role.id}>` }),
        t('moderation.yetki.given_body'),
      ]),
    );
  },
};
