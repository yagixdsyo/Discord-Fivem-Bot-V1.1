/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate } from '../../../ui/templates/index.js';
import { cancelTask, listPendingTasks } from '../lib/schedule.js';
import { findActiveByUser, liftActivePunishments } from '../lib/store.js';
import { logPunishment, punishErrorCard, reasonText } from '../lib/punishFlow.js';
import { punishmentResultPayload } from '../lib/view.js';

export default {
  name: 'banaç',
  aliases: ['banac', 'unban'],
  description: 'Bir kullanıcının (kalıcı olmayan) yasağını kaldırır.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 5,
  permission: { discord: ['BanMembers'], node: 'moderation.ban' },
  args: [
    { name: 'kullanici', type: 'user', required: true, description: 'Yasağı kaldırılacak kullanıcı' },
    { name: 'sebep', type: 'rest', required: false, description: 'Kaldırma sebebi' },
  ],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const target = ctx.args.kullanici;
    const targetUser = target?.user ?? target;
    const reason = reasonText(ctx);

    const { lifted, cases } = await liftActivePunishments(ctx.guild.id, {
      userId: targetUser.id,
      types: ['ban'],
      permanent: false,
      actorId: ctx.user.id,
      reason: reason ?? 'Ban açıldı',
    });

    if (lifted === 0) {
      // Kalici yasak var mi? (bilgi mesaji icin)
      const active = await findActiveByUser(ctx.guild.id, targetUser.id).catch(() => []);
      const hasPermanent = active.some((doc) => doc.type === 'ban' && doc.permanent);
      await ctx.reply(punishErrorCard(t, hasPermanent ? 'permanent_only' : 'no_active_ban'));
      return;
    }

    await ctx.guild.bans.remove(targetUser.id, reason ?? 'Ban açıldı').catch(() => {});

    // Bekleyen otomatik unban gorevleri iptal
    const pending = await listPendingTasks(ctx.guild.id, 'unban').catch(() => []);
    for (const task of pending) {
      if (task.payload?.userId === targetUser.id) await cancelTask(task.task_id).catch(() => {});
    }

    await logPunishment(ctx, {
      key: 'log_unban',
      targetUserId: targetUser.id,
      targetTag: targetUser.username,
      reason,
      lines: [`Açılan ceza: \`${cases[0]?.case_id ?? '-'}\``],
      accent: 'success',
    });

    await ctx.reply(
      punishmentResultPayload(t, {
        action: 'unban',
        userId: targetUser.id,
        userTag: targetUser.username,
        caseId: cases[0]?.case_id ?? null,
        reason,
      }),
    );
  },
};
