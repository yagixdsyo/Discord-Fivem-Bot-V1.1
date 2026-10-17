/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { cancelTask, listPendingTasks } from '../lib/schedule.js';
import { liftActivePunishments } from '../lib/store.js';
import { logPunishment, punishErrorCard, reasonText } from '../lib/punishFlow.js';
import { punishmentResultPayload } from '../lib/view.js';

export default {
  name: 'unmute',
  aliases: ['susturma-kaldir', 'susturmakaldir'],
  description: 'Bir kullanıcının susturmasını kaldırır.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  permission: { discord: ['ModerateMembers'], node: 'moderation.mute' },
  args: [
    { name: 'kullanici', type: 'member', required: true, description: 'Susturması kaldırılacak üye' },
    { name: 'sebep', type: 'rest', required: false, description: 'Kaldırma sebebi' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const targetMember = ctx.args.kullanici;
    const targetUser = targetMember.user;
    const reason = reasonText(ctx);

    await targetMember.timeout(null, reason ?? 'Moderasyon: susturma kaldırıldı').catch(() => {});

    const { lifted, cases } = await liftActivePunishments(ctx.guild.id, {
      userId: targetUser.id,
      types: ['mute'],
      actorId: ctx.user.id,
      reason: reason ?? 'Susturma kaldırıldı',
    });

    const pending = await listPendingTasks(ctx.guild.id, 'unmute').catch(() => []);
    for (const task of pending) {
      if (task.payload?.userId === targetUser.id) await cancelTask(task.task_id).catch(() => {});
    }

    if (lifted === 0) {
      await ctx.reply(punishErrorCard(t, 'no_active_mute'));
      return;
    }

    await logPunishment(ctx, {
      key: 'log_mute',
      targetUserId: targetUser.id,
      targetTag: targetUser.username,
      reason,
      lines: [`Kapatılan ceza: \`${cases[0]?.case_id ?? '-'}\``, 'Susturma kaldırıldı.'],
      accent: 'success',
    });

    await ctx.reply(
      punishmentResultPayload(t, {
        action: 'unmute',
        userId: targetUser.id,
        userTag: targetUser.username,
        caseId: cases[0]?.case_id ?? null,
        reason,
      }),
    );
  },
};
