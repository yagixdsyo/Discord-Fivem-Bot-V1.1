/**
 * Xqeria Dev V1.1 - discord.gg/bdfd
 */

import { error as errorTemplate, success, confirm as confirmTemplate, card } from '../../../ui/templates/index.js';
import { runConfirm } from '../lib/uiFlow.js';
import { cancelTask, listPendingTasks } from '../lib/schedule.js';
import { emitLog } from '../../logging/lib/emit.js';
import { reasonText } from '../lib/punishFlow.js';

export default {
  name: 'banaffı',
  aliases: ['banaffi', 'unbanall'],
  description: 'Tüm (kalıcı olmayan) banları toplu açar.',
  category: 'Moderasyon',
  system: 'moderasyon',
  cooldown: 30,
  permission: { discord: ['BanMembers'], node: 'moderation.ban' },
  args: [{ name: 'sebep', type: 'rest', required: false, description: 'Kaldırma sebebi' }],

  async run(ctx) {
    const t = ctx.t;
    if (!ctx.db.ready) {
      await ctx.reply(errorTemplate(t('setup.db_not_ready.title'), [t('setup.db_not_ready.body')]));
      return;
    }

    const store = await import('../lib/store.js');
    const dbBans = await store.listActiveBans(ctx.guild.id).catch(() => []);
    const permaIds = new Set(dbBans.filter((doc) => doc.permanent).map((doc) => doc.user_id));
    const nonPermaDb = dbBans.filter((doc) => !doc.permanent);

    const bans = await ctx.guild.bans.fetch().catch(() => null);
    if (!bans) {
      await ctx.reply(errorTemplate(t('moderation.banaffi.fail_title'), [t('moderation.banaffi.fail')]));
      return;
    }

    const targets = [];
    let permaInList = 0;
    for (const [userId] of bans) {
      if (permaIds.has(userId)) {
        permaInList += 1;
        continue;
      }
      targets.push(userId);
    }

    if (!targets.length && !nonPermaDb.length) {
      await ctx.reply(errorTemplate(t('moderation.banaffi.empty_title'), [t('moderation.banaffi.empty')]));
      return;
    }

    const reason = reasonText(ctx) ?? 'Toplu ban affı';
    const ownerId = ctx.user.id;
    const payload = confirmTemplate({
      title: t('moderation.banaffi.confirm_title'),
      description: [
        t('moderation.banaffi.confirm_body', { adet: targets.length }),
        permaInList ? t('moderation.banaffi.confirm_perma', { adet: permaInList }) : null,
      ].filter(Boolean),
      confirmId: `banaffionay:${ownerId}`,
      cancelId: `banaffiiptal:${ownerId}`,
      confirmLabel: t('common.confirm'),
      danger: true,
    });

    const confirmed = await runConfirm(ctx, {
      payload,
      ownerId,
      confirmId: `banaffionay:${ownerId}`,
      cancelId: `banaffiiptal:${ownerId}`,
    });
    if (!confirmed) return;

    // İlerleme kartı
    const progress = (islenen, toplam) =>
      card({
        emojiKey: 'BEKLE',
        title: t('moderation.banaffi.progress_title'),
        lines: [t('moderation.banaffi.progress', { islenen, toplam })],
        accent: 'warn',
      });

    await confirmed.editReply(progress(0, targets.length)).catch(() => {});

    let done = 0;
    let failed = 0;
    for (const userId of targets) {
      const ok = await ctx.guild.bans
        .remove(userId, reason)
        .then(() => true)
        .catch(() => false);
      if (ok) done += 1;
      else failed += 1;
      if ((done + failed) % 10 === 0) {
        await confirmed.editReply(progress(done + failed, targets.length)).catch(() => {});
      }
    }

    // DB kayıtlarını kapat (kalıcı olmayan)
    for (const doc of nonPermaDb) {
      await store.liftPunishment(ctx.guild.id, doc.case_id, { actorId: ctx.user.id, reason }).catch(() => {});
    }

    // Bekleyen otomatik unban görevlerini iptal et
    const pending = await listPendingTasks(ctx.guild.id, 'unban').catch(() => []);
    const targetSet = new Set(targets);
    for (const task of pending) {
      if (targetSet.has(task.payload?.userId)) await cancelTask(task.task_id).catch(() => {});
    }

    await emitLog(ctx.guild, 'log_unban', {
      actor: ctx.user.id,
      actorTag: ctx.user.username,
      lines: [
        t('moderation.banaffi.log', { adet: done, perma: permaInList }),
        t('moderation.banaffi.log_db', { adet: nonPermaDb.length }),
      ],
      accent: 'success',
    }).catch(() => {});

    const lines = [
      t('moderation.banaffi.done', { adet: done }),
      failed ? t('moderation.banaffi.failed', { adet: failed }) : null,
      permaInList ? t('moderation.banaffi.confirm_perma', { adet: permaInList }) : null,
    ].filter(Boolean);

    await confirmed.editReply(success(t('moderation.banaffi.done_title'), lines)).catch(() => {});
  },
};
