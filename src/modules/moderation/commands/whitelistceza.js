/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { scheduleTask } from '../lib/schedule.js';
import { addPunishment } from '../lib/store.js';
import { grantRole } from '../lib/roles.js';
import { ensurePunishAllowed, logPunishment, punishErrorCard, reasonText } from '../lib/punishFlow.js';
import { whitelistPunishPayload } from '../lib/view.js';

export default {
  name: 'whitelist-ceza',
  aliases: ['whitelistceza', 'wl-ceza', 'wlceza'],
  description: 'Whitelist yasağı rolü verir; süre bitince rol otomatik geri alınır.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  permission: { discord: ['ManageRoles'] },
  args: [
    { name: 'kullanici', type: 'member', required: true, description: 'Ceza verilecek üye' },
    { name: 'rol', type: 'role', required: true, description: 'Whitelist yasak rolü' },
    { name: 'sure', type: 'duration', required: true, description: 'Süre (örn. 7g)' },
    { name: 'sebep', type: 'rest', required: false, description: 'Ceza sebebi' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const targetMember = ctx.args.kullanici;
    const targetUser = targetMember.user;
    const role = ctx.args.rol;
    const durationMs = ctx.args.sure?.ms ?? null;
    const durationText = ctx.args.sure?.display ?? null;

    const problem = await ensurePunishAllowed(ctx, {
      targetUserId: targetUser.id,
      targetMember,
      permission: 'ManageRoles',
    });
    if (problem) {
      await ctx.reply(punishErrorCard(t, problem));
      return;
    }
    if (!durationMs) {
      await ctx.reply(punishErrorCard(t, 'duration_required'));
      return;
    }

    const reason = reasonText(ctx);
    const granted = await grantRole({
      guild: ctx.guild,
      actorMember: ctx.member,
      botMember: ctx.guild.members.me,
      targetMember,
      role,
      reason: reason ?? 'Whitelist cezası',
      via: 'komut',
      actorId: ctx.user.id,
      actorTag: ctx.user.username ?? null,
    });
    if (!granted.ok) {
      await ctx.reply(
        errorTemplate(
          t('moderation.errors.role_denied.title'),
          [t('moderation.errors.role_denied.body', { sebep: granted.reason ?? 'bilinmiyor' })],
        ),
      );
      return;
    }

    const doc = await addPunishment({
      guildId: ctx.guild.id,
      userId: targetUser.id,
      userName: targetUser.username ?? null,
      type: 'whitelist',
      reason,
      actorId: ctx.user.id,
      actorTag: ctx.user.username ?? null,
      durationMs,
      meta: { role_id: role.id, role_name: role.name },
    });

    await scheduleTask({
      guildId: ctx.guild.id,
      kind: 'whitelist_restore',
      runAt: new Date(Date.now() + durationMs),
      payload: { guildId: ctx.guild.id, userId: targetUser.id, roleId: role.id, caseId: doc.case_id },
    }).catch(() => {});

    await logPunishment(ctx, {
      key: 'log_whitelist',
      targetUserId: targetUser.id,
      targetTag: targetUser.username,
      reason,
      lines: [
        `Rol: <@&${role.id}>`,
        `Süre: **${durationText}**`,
        `Kayıt: \`${doc.case_id}\``,
        reason ? `Sebep: ${reason}` : null,
      ].filter(Boolean),
      accent: 'warn',
    });

    await ctx.reply(
      whitelistPunishPayload(t, {
        userTag: targetUser.username,
        userId: targetUser.id,
        roleName: `<@&${role.id}>`,
        durationText,
        caseId: doc.case_id,
      }),
    );
  },
};
